const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");
const { Anthropic } = require("@anthropic-ai/sdk");
const { env } = require("../config/env");
const { withRetry, withTimeout } = require("../utils/asyncTools");
const { sanitizeEmailForAI } = require("../security/dlp");
const { logger } = require("../utils/logger");
const { getRecommendedLlm, isProviderAvailable } = require("./llmSelector");

// Lazy initialization for LLMs (avoid startup errors if keys missing)
let geminiBeclient = null;
let geminiBlockedUntilMs = 0;
let openaiClient = null;
let anthropicClient = null;
let openaiBlockedUntilMs = 0;

function getGeminiClient() {
  if (!geminiBeclient && env.GEMINI_API_KEY) {
    geminiBeclient = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }
  return geminiBeclient;
}

function getOpenaiClient() {
  if (!openaiClient && env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function getAnthropicClient() {
  if (!anthropicClient && env.ANTHROPIC_API_KEY && String(env.ANTHROPIC_API_KEY).trim()) {
    anthropicClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

/**
 * Elite/admin: Claude first when key exists (unless USE_SONNET_FOR_INITIAL_SYNC=false).
 * Pro: Claude on initial sync only when USE_SONNET_FOR_INITIAL_SYNC=true.
 */
function shouldTryAnthropicExtraction(llmConfig, userRole, syncMode) {
  if (!llmConfig || !isProviderAvailable("anthropic")) {
    return false;
  }
  if (env.USE_SONNET_FOR_INITIAL_SYNC === "false") {
    return false;
  }
  const r = String(userRole || "").toLowerCase();
  const initial = syncMode === "initial";
  if (r === "elite" || r === "admin") {
    return true;
  }
  if (r === "pro" && initial && env.USE_SONNET_FOR_INITIAL_SYNC === "true") {
    return true;
  }
  return false;
}

/**
 * Provider preference order:
 * 1. Gemini (free, fast, 95%+ accuracy for structured extraction)
 * 2. OpenAI gpt-4o-mini (cheap backup if Gemini is rate-limited)
 * 3. Anthropic (only if USE_SONNET_FOR_INITIAL_SYNC=true and key exists)
 */
function getWindowProviderPreference() {
  return "gemini";
}

function markGeminiUnavailable(reason) {
  const blockHours = Number.isFinite(env.GEMINI_COOLDOWN_HOURS) ? env.GEMINI_COOLDOWN_HOURS : 6;
  geminiBlockedUntilMs = Date.now() + Math.max(1, blockHours) * 60 * 60 * 1000;
  logger.warn("Gemini calls paused for cooldown", { reason, untilIso: new Date(geminiBlockedUntilMs).toISOString() });
}

function markOpenaiUnavailable(reason) {
  const blockHours = Number.isFinite(env.OPENAI_COOLDOWN_HOURS) ? env.OPENAI_COOLDOWN_HOURS : 6;
  openaiBlockedUntilMs = Date.now() + Math.max(1, blockHours) * 60 * 60 * 1000;
  logger.warn("OpenAI calls paused for cooldown", { reason, untilIso: new Date(openaiBlockedUntilMs).toISOString() });
}

function isGeminiBlocked() {
  if (!env.GEMINI_API_KEY || String(env.GEMINI_API_KEY).trim() === "") {
    return true;
  }
  return Date.now() < geminiBlockedUntilMs;
}

function isOpenaiBlocked() {
  if (!env.OPENAI_API_KEY || String(env.OPENAI_API_KEY).trim() === "") {
    return true;
  }
  return Date.now() < openaiBlockedUntilMs;
}

function normalizeEmailType(rawType) {
  const value = String(rawType || "").toLowerCase();

  if (value.includes("application")) return "Application Confirmation";
  if (value.includes("interview")) return "Interview Scheduled";
  if (value.includes("offer")) return "Offer";
  if (value.includes("reject")) return "Rejection";
  if (value.includes("auto") || value.includes("tracking")) return "Auto / Tracking";
  if (value.includes("real email")) return "Recruiter Outreach";
  if (value.includes("recruiter")) return "Recruiter Outreach";

  return "Auto / Tracking";
}

function normalizeStatus(rawStatus) {
  const value = String(rawStatus || "").toLowerCase();
  if (value.includes("screen")) return "Screening";
  if (value.includes("interview")) return "Interview";
  if (value.includes("offer")) return "Offer";
  if (value.includes("reject")) return "Rejected";
  if (value.includes("wish")) return "Wishlist";
  return "Applied";
}

function cleanEmailBody(body) {
  body = String(body || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#169;/g, "©")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&rsquo;/g, "'");

  body = body.replace(/https?:\/\/[^\s]+/g, "");

  const boilerplatePatterns = [
    /this is an automated email[^.]*\./gi,
    /please do not reply[^.]*\./gi,
    /if you no longer wish[^.]*/gi,
    /if you don't want to receive[^.]*/gi,
    /this message was sent to[^.]*/gi,
    /\*{3,}/g,
    /={3,}/g,
    /-{3,}/g,
    /©.*$/gm,
    /copyright.*$/gim,
    /\d{5}.*USA.*/gi,
    /^.*(?:Way;|Street;|\bOH\b|\bUSA\b).*$/gim,
  ];
  boilerplatePatterns.forEach((p) => {
    body = body.replace(p, "");
  });

  body = body.replace(/\s+/g, " ").trim();

  return body.slice(0, 1500);
}

function deriveStatusFromText(subject, body) {
  const text = `${subject || ""} ${body || ""}`.toLowerCase();
  if (/\bnot moving forward\b|\bnot selected\b|\bposition (?:has been )?filled\b|\bwe (?:have |will not|won't) be proceeding\b|\bunfortunately.*(?:decided|chosen|pursue)\b/.test(text)) return "Rejected";
  if (/\bwe (?:are |would like to )?(?:pleased to )?extend (?:you )?(?:an? )?offer\b|\bjob offer\b|\boffer letter\b/.test(text)) return "Offer";
  if (/\bschedule[d]? (?:an? |your )?interview\b|\binvit(?:e|ed|ing) (?:you )?(?:to |for )?(?:an? )?interview\b|\binterview (?:on|at|scheduled)\b/.test(text)) return "Interview";
  if (/\blike to schedule a (?:call|screen|chat)\b|\bphone screen\b/.test(text)) return "Screening";
  return "Applied";
}

function deriveEmailTypeFromSender(sender) {
  const s = String(sender || "").toLowerCase();
  if (s.includes("noreply") || s.includes("no-reply") || s.includes("notifications@")) return "Auto / Tracking";
  return "Recruiter Outreach";
}

function deriveRoleFromText(subject, body) {
  const text = `${subject || ""}\n${body || ""}`;
  const patterns = [
    /for the\s+(.+?)\s+position/i,
    /for\s+the\s+role\s+of\s+(.+?)(?:[.,\n]|$)/i,
    /position:\s*(.+?)(?:[.,\n]|$)/i,
    /role:\s*(.+?)(?:[.,\n]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const role = match[1].trim().replace(/\s{2,}/g, " ");
      if (role.length >= 3 && role.length <= 120) return role;
    }
  }

  return null;
}

function deriveCompanyFromSender(sender) {
  const raw = String(sender || "");
  const matched = raw.match(/^"?([^"<]+?)"?\s*</);
  const name = (matched?.[1] || raw.split("@")[0] || "").trim();
  const cleaned = name
    .replace(/\b(recruiting|careers|talent|hr|team)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned || null;
}

function isNoisySender(from, subject) {
  const sender = String(from || "").toLowerCase();
  const subj = String(subject || "").toLowerCase();
  const noisySenders = [
    "glassdoor", "ziprecruiter", "indeed.com", "interviewmaster",
    "interview master", "careerbuilder", "monster.com", "hired.com",
    "angellist", "wellfound", "dice.com", "themuse", "the muse",
    "handshake", "wayup", "huntr", "jobcase", "lensa",
    "theforage", "forage.com", "naukri", "simplyhired", "builtin",
    "otta.com", "triplebyte", "employbl",
  ];
  const noisySubjects = [
    "job alert", "jobs for you", "recommended jobs", "jobs you may",
    "new jobs", "daily digest", "weekly digest", "newsletter",
    "career tips", "interview tips", "resume tips", "salary guide",
    "unsubscribe", "community digest", "top companies",
    "has just opened", "just opened applications", "opportunities that suit",
    "job simulation", "virtual experience",
  ];
  if (noisySenders.some((n) => sender.includes(n))) return true;
  if (noisySubjects.some((n) => subj.includes(n))) return true;
  return false;
}

function fallbackExtractJobInfo({ subject, from, date, body }) {
  if (isNoisySender(from, subject)) {
    return null;
  }

  const text = `${subject || ""} ${body || ""}`.toLowerCase();
  const strongSignals =
    /\b(thank you for applying|thank you for your interest|your application|application received|we have decided|not moving forward|unfortunately|talent acquisition|position filled|stop pursuing)\b/.test(
      text
    );
  const weakSignals =
    /\b(application|applied|rejected|rejection|position|recruiter|hiring team)\b/.test(text);
  const noisySignals =
    /\b(job alert|recommended jobs|jobs you may be interested|digest|newsletter|sponsored|promo|deals?)\b/.test(text);
  const likelyJob = strongSignals || (weakSignals && !noisySignals);

  if (!likelyJob) {
    return null;
  }

  const status = deriveStatusFromText(subject, body);
  const emailType = deriveEmailTypeFromSender(from);
  const appliedDate = Number.isNaN(new Date(date).getTime())
    ? new Date().toISOString().slice(0, 10)
    : new Date(date).toISOString().slice(0, 10);

  return {
    isJobRelated: true,
    company: deriveCompanyFromSender(from),
    role: deriveRoleFromText(subject, body),
    status,
    location: null,
    recruiterName: null,
    recruiterEmail: null,
    appliedDate,
    notes: "Parsed using fallback rules because AI extraction was unavailable.",
    nextStep: null,
    emailType,
    isReal: emailType !== "Auto / Tracking",
    extractionSource: "fallback",
  };
}

function withModelSource(result) {
  if (!result) {
    return null;
  }
  return { ...result, extractionSource: "model" };
}

async function extractJobInfo({
  subject,
  from,
  date,
  body,
  userRole = "free",
  syncMode = "daily",
  syncLookbackDays = null,
}) {
  // Check if user tier has AI enabled
  const llmConfig = getRecommendedLlm(userRole);
  
  if (!llmConfig) {
    logger.debug("AI extraction disabled for tier", { userRole });
    return fallbackExtractJobInfo({ subject, from, date, body });
  }

  let cleanedBody = cleanEmailBody(body);
  // Sanitize PII (SSN, credit cards, passwords, etc.) before sending to AI
  cleanedBody = sanitizeEmailForAI(cleanedBody);

  const extractionPrompt = `You are a strict job application email classifier. Analyze this email and return ONLY valid JSON.

CRITICAL: Most application emails are just confirmations. Default status is ALWAYS "Applied" unless you find HARD EVIDENCE below.

NOT JOB-RELATED (set isJobRelated: false):
- Job alert digests, recommended jobs, "jobs you may like"
- Newsletter, marketing, promotional emails
- Platform notifications (Glassdoor community, LinkedIn digest, ZipRecruiter alerts, Interview Master tips, career advice)
- Password resets, account notifications, subscription emails
- Emails that mention jobs generically but are NOT about YOUR specific application

COMPANY NAME RULES:
- Extract from body: "applying to [X]", "your application at [X]", "interest in [X]"
- From name if it contains a real company (e.g. "Bio-Rad Recruiting" = Bio-Rad)
- NEVER use ATS platforms as company: iCIMS, Greenhouse, Lever, Workday, 365ats, Taleo
- NEVER use job platforms as company: Glassdoor, ZipRecruiter, Indeed, LinkedIn, Interview Master, Hired, AngelList
- If truly unknown, return null

STATUS RULES - BE VERY CONSERVATIVE:
- "Applied": DEFAULT for any application confirmation, acknowledgment, "we received your application", "thank you for applying". USE THIS WHEN IN DOUBT.
- "Screening": ONLY if a real recruiter explicitly asks to schedule a phone call or screen with you
- "Interview": ONLY if there is a specific interview invitation with date/time/link, or explicit "we'd like to interview you". The word "interview" appearing in marketing text or tips does NOT count.
- "Offer": ONLY if there is an explicit job offer with role and compensation details. Words like "we offer benefits" or "congratulations on completing your application" do NOT count.
- "Rejected": ONLY if explicitly says "not moving forward", "position filled", "we will not be proceeding", "unfortunately we have decided"
- "Wishlist": ONLY for job alerts or suggestions where no application was submitted

EMAIL TYPE:
- "Auto/Tracking": automated ATS emails (noreply, no-reply, notifications@)
- "Recruiter Outreach": a real human recruiter wrote to you
- "Real email": genuine non-automated communication

Return this exact JSON:
{
  "isJobRelated": true or false,
  "company": "string or null",
  "role": "string or null",
  "status": "Applied|Screening|Interview|Offer|Rejected|Wishlist",
  "location": "string or null",
  "recruiterName": "string or null",
  "recruiterEmail": "string or null",
  "appliedDate": "YYYY-MM-DD",
  "notes": "one sentence summary",
  "nextStep": "string or null",
  "emailType": "Auto/Tracking|Recruiter Outreach|Real email"
}

Subject: ${subject}
From: ${from}
Date: ${date}
Body: ${cleanedBody}`;

  try {
    // === PRIMARY: Gemini (FREE, fast, excellent for structured extraction) ===
    if (!isGeminiBlocked()) {
      const geminiClient = getGeminiClient();
      if (geminiClient) {
        const geminiModel = env.GEMINI_MODEL || "gemini-2.0-flash";
        logger.info("Attempting Gemini extraction", { subject: subject.slice(0, 50), model: geminiModel });
        try {
          const model = geminiClient.getGenerativeModel({ model: geminiModel });
          const res = await withRetry(
            () =>
              withTimeout(
                async () => {
                  const response = await model.generateContent({
                    contents: [{ role: "user", parts: [{ text: extractionPrompt }] }],
                    generationConfig: { maxOutputTokens: 500, responseMimeType: "application/json" },
                  });
                  return response;
                },
                env.EXTERNAL_API_TIMEOUT_MS,
                "Gemini extraction timed out"
              ),
            { retries: Math.max(0, env.RETRY_ATTEMPTS) }
          );

          const raw = res.response?.text?.() || "{}";
          const stripped = raw.replace(/```json|```/g, "").trim();
          let parsed;
          try { parsed = JSON.parse(stripped); }
          catch { const match = stripped.match(/\{[\s\S]*\}/); parsed = match ? JSON.parse(match[0]) : {}; }

          logger.info("Gemini extraction succeeded", {
            subject: subject.slice(0, 50),
            isJobRelated: parsed.isJobRelated,
            company: parsed.company,
            role: parsed.role,
          });
          return withModelSource(buildExtractedJobResult(parsed, subject, from, date, body));
        } catch (geminiError) {
          const msg = String(geminiError.message || "");
          if (/429|quota|API_KEY_INVALID|API key expired/i.test(msg)) {
            markGeminiUnavailable(msg.slice(0, 120));
          }
          logger.error("Gemini extraction FAILED, trying backup", { error: geminiError.message, subject: subject.slice(0, 50) });
        }
      }
    }

    // === BACKUP: OpenAI gpt-4o-mini (cheap, used only when Gemini is down) ===
    const openaiRef = getOpenaiClient();
    if (openaiRef && !isOpenaiBlocked()) {
      logger.info("Attempting OpenAI backup extraction", { subject: subject.slice(0, 50) });
      try {
        const response = await withRetry(
          () =>
            withTimeout(
              async () => openaiRef.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: extractionPrompt }],
                temperature: 0.3,
                max_tokens: 500,
                response_format: { type: "json_object" },
              }),
              env.EXTERNAL_API_TIMEOUT_MS,
              "OpenAI extraction timed out"
            ),
          { retries: Math.max(0, env.RETRY_ATTEMPTS) }
        );

        const raw = response.choices?.[0]?.message?.content || "{}";
        const stripped = raw.replace(/```json|```/g, "").trim();
        let parsed;
        try { parsed = JSON.parse(stripped); }
        catch { const match = stripped.match(/\{[\s\S]*\}/); parsed = match ? JSON.parse(match[0]) : {}; }

        logger.info("OpenAI extraction succeeded", {
          subject: subject.slice(0, 50),
          isJobRelated: parsed.isJobRelated,
          company: parsed.company,
          role: parsed.role,
        });
        return withModelSource(buildExtractedJobResult(parsed, subject, from, date, body));
      } catch (openaiError) {
        const msg = String(openaiError?.message || "");
        if (/429|quota|insufficient_quota|billing/i.test(msg)) {
          markOpenaiUnavailable(msg.slice(0, 120));
        }
        logger.error("OpenAI extraction FAILED", { error: openaiError.message, subject: subject.slice(0, 50) });
      }
    }

    // === LAST RESORT: Anthropic (only if explicitly enabled and key exists) ===
    if (env.USE_SONNET_FOR_INITIAL_SYNC === "true") {
      const client = getAnthropicClient();
      if (client) {
        const modelId = env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
        logger.info("Attempting Anthropic last-resort extraction", { subject: subject.slice(0, 50), model: modelId });
        try {
          const response = await withRetry(
            () =>
              withTimeout(
                async () => client.messages.create({
                  model: modelId,
                  max_tokens: 1024,
                  messages: [{ role: "user", content: extractionPrompt }],
                }),
                env.EXTERNAL_API_TIMEOUT_MS,
                "Anthropic extraction timed out"
              ),
            { retries: Math.max(0, env.RETRY_ATTEMPTS) }
          );
          const textBlock = response.content?.find((b) => b.type === "text");
          const raw = textBlock?.text || "{}";
          const stripped = raw.replace(/```json|```/g, "").trim();
          let parsed;
          try { parsed = JSON.parse(stripped); }
          catch { const match = stripped.match(/\{[\s\S]*\}/); parsed = match ? JSON.parse(match[0]) : {}; }

          logger.info("Anthropic extraction succeeded", {
            subject: subject.slice(0, 50),
            isJobRelated: parsed.isJobRelated,
            company: parsed.company,
            role: parsed.role,
          });
          return withModelSource(buildExtractedJobResult(parsed, subject, from, date, body));
        } catch (anthropicError) {
          logger.error("Anthropic extraction FAILED", { error: anthropicError.message, subject: subject.slice(0, 50) });
        }
      }
    }

    // All providers failed - use rule-based fallback
    logger.warn("All LLM providers failed, using rule-based extraction", { subject: subject.slice(0, 50) });
    return fallbackExtractJobInfo({ subject, from, date, body });
  } catch (error) {
    logger.error("Job extraction unexpected error", { error: error.message, userRole });
    return fallbackExtractJobInfo({ subject, from, date, body });
  }
}

function buildExtractedJobResult(parsed, subject, from, date, body) {
  const normalizedEmailType = normalizeEmailType(parsed.emailType);

  if (parsed.isJobRelated === false) {
    return {
      ...parsed,
      company: parsed.company || null,
      role: parsed.role || null,
      status: normalizeStatus(parsed.status),
      appliedDate: parsed.appliedDate || null,
      emailType: normalizedEmailType,
      isReal: normalizedEmailType !== "Auto / Tracking",
      isJobRelated: false,
    };
  }

  // Model often omits isJobRelated. Gmail query already keyword-filters; fill gaps from rules.
  if (parsed.isJobRelated !== true) {
    const fb = fallbackExtractJobInfo({ subject, from, date, body });
    if (!fb) {
      return {
        ...parsed,
        company: parsed.company || null,
        role: parsed.role || null,
        status: normalizeStatus(parsed.status),
        appliedDate: parsed.appliedDate || null,
        emailType: normalizedEmailType,
        isReal: normalizedEmailType !== "Auto / Tracking",
        isJobRelated: false,
      };
    }
    const emailTypeMerged = normalizedEmailType || fb.emailType;
    return {
      ...fb,
      company: parsed.company || fb.company || null,
      role: parsed.role || fb.role || null,
      status: normalizeStatus(parsed.status || fb.status),
      appliedDate: parsed.appliedDate || fb.appliedDate || null,
      notes: parsed.notes || fb.notes || null,
      nextStep: parsed.nextStep ?? fb.nextStep,
      location: parsed.location ?? fb.location,
      recruiterName: parsed.recruiterName ?? fb.recruiterName,
      recruiterEmail: parsed.recruiterEmail ?? fb.recruiterEmail,
      emailType: emailTypeMerged,
      isReal: emailTypeMerged !== "Auto / Tracking",
      isJobRelated: true,
    };
  }

  return {
    ...parsed,
    company: parsed.company || null,
    role: parsed.role || null,
    status: normalizeStatus(parsed.status),
    appliedDate: parsed.appliedDate || null,
    emailType: normalizedEmailType,
    isReal: normalizedEmailType !== "Auto / Tracking",
    isJobRelated: true,
  };
}

module.exports = { extractJobInfo };

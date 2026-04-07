const Anthropic = require("@anthropic-ai/sdk");
const { env } = require("../config/env");
const { withRetry, withTimeout } = require("../utils/asyncTools");
const { sanitizeEmailForAI } = require("../security/dataLossPrevention");

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

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

async function extractJobInfo({ subject, from, date, body }) {
  try {
    let cleanedBody = cleanEmailBody(body);
    // Sanitize PII (SSN, credit cards, passwords, etc.) before sending to Claude
    cleanedBody = sanitizeEmailForAI(cleanedBody);
    const res = await withRetry(
      () =>
        withTimeout(
          () =>
            anthropic.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 500,
              messages: [
                {
                  role: "user",
                  content: `You are a job application email parser. Analyze this email carefully and return ONLY valid JSON with no extra text.

COMPANY NAME RULES:
- Extract from email body phrases like 'applying to [X]', 'your application at [X]', 'interest in [X]'
- Extract from From name if it contains a company name
- Never use ATS platform names (iCIMS, Greenhouse, Lever, Workday, 365ats, Taleo) as company name
- If truly unknown, return null

To find the company name:
1. Check the email body for phrases like 'Thank you for applying to [Company]',
   'your application to [Company]', 'interest in joining [Company]'
2. Check the From name (e.g. 'Bio-Rad Recruiting' means company = Bio-Rad)
3. Check the sender domain — notifications@365ats.com means
   extract company from the email body, not the domain
4. Never use the ATS platform name (365ats, iCIMS, Greenhouse,
   Lever, Workday) as the company name
5. If company truly cannot be found, set company to null,
   not 'Unknown Company'

STATUS RULES:
- Applied: confirmation that application was received
- Screening: recruiter wants to schedule a call or phone screen
- Interview: interview scheduled or invitation sent
- Offer: job offer made
- Rejected: not moving forward, position filled, other candidates
- Wishlist: job alert, job suggestion, no application made yet

EMAIL TYPE RULES:
- 'Auto / Tracking': automated system emails from ATS platforms
- 'Recruiter Outreach': real human recruiter wrote the email
- 'Real email': genuine non-automated communication

For appliedDate:
- If this is a rejection or status update email and no
  application date is mentioned, set appliedDate to today's
  date in YYYY-MM-DD format as a best estimate
- Never return null for appliedDate on rejection emails —
  use the email's received date as fallback

Return this exact JSON:
{
  "isJobRelated": true,
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
Body: ${cleanedBody}`,
                },
              ],
            }),
          env.EXTERNAL_API_TIMEOUT_MS,
          "Claude extraction timed out"
        ),
      { retries: Math.max(env.RETRY_ATTEMPTS, 3) }
    );

    const text = res.content[0]?.text || "{}";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());

    const normalizedEmailType = normalizeEmailType(parsed.emailType);
    return {
      ...parsed,
      company: parsed.company || null,
      role: parsed.role || null,
      status: normalizeStatus(parsed.status),
      appliedDate: parsed.appliedDate || null,
      emailType: normalizedEmailType,
      isReal: normalizedEmailType !== "Auto / Tracking",
    };
  } catch (error) {
    console.error("Job extraction failed:", error.message);
    return null;
  }
}

module.exports = { extractJobInfo };

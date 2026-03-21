const Anthropic = require("@anthropic-ai/sdk");
const { env } = require("../config/env");

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

async function extractJobInfo({ subject, from, date, body }) {
  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `You are a job application email parser. Return ONLY valid JSON, no extra text:\n{"isJobRelated":true,"company":"name","role":"title","status":"Applied","location":"loc","recruiterName":"name","recruiterEmail":"email","appliedDate":"YYYY-MM-DD","notes":"summary","nextStep":"next action"}\nStatus: Applied | Screening | Interview | Offer | Rejected | Wishlist\nSubject: ${subject}\nFrom: ${from}\nDate: ${date}\nBody: ${body}`,
        },
      ],
    });

    const text = res.content[0]?.text || "{}";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return null;
  }
}

module.exports = { extractJobInfo };

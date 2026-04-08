const { env } = require("../config/env");
const { sanitizeEmailForAI } = require("../security/dataLossPrevention");

/**
 * AI Interview Coach - Answer questions and get coaching feedback
 * Elite tier only
 *
 * @param {string} question - Interview question or user input
 * @param {string} jobTitle - Position title for context
 * @param {string} jobDescription - Job description for context
 * @returns {Promise<{answer: string, tip: string, feedback: string}>}
 */
async function getInterviewCoaching(question, jobTitle, jobDescription = "") {
  if (!env.GEMINI_API_KEY) {
    throw new Error('Gemini API not configured');
  }

  try {
    const sanitized = sanitizeEmailForAI(jobDescription);

    const prompt = `
You are an expert interview coach. Help the candidate prepare for a ${jobTitle} interview.

JOB CONTEXT:
${sanitized || "No job description provided"}

QUESTION:
"${question}"

Provide:
1. A strong, concise answer (2-3 sentences) that demonstrates:
   - Relevant experience or skills
   - Understanding of the role
   - Enthusiasm for the position

2. A pro tip (1 sentence) for delivering this answer effectively

3. Interview feedback (1-2 sentences) on common mistakes to avoid

Format as follows:
ANSWER: [your answer here]

PRO TIP: [one sentence tip]

FEEDBACK: [coaching feedback]
    `.trim();

    const response = await callGemini(prompt);
    const parsed = parseCoachingResponse(response);

    return {
      success: true,
      ...parsed,
    };
  } catch (error) {
    console.error('[interviewCoachService]:', error.message);
    throw new Error('Failed to get coaching: ' + error.message);
  }
}

/**
 * Get common interview questions for a job
 * Elite tier only
 */
async function getCommonQuestions(jobTitle, jobDescription = "") {
  if (!env.GEMINI_API_KEY) {
    throw new Error('Gemini API not configured');
  }

  try {
    const sanitized = sanitizeEmailForAI(jobDescription);

    const prompt = `
You are an expert recruiter. List 5 common interview questions for a ${jobTitle} position.

Job context:
${sanitized || "General professional role"}

Provide ONLY the 5 questions as a numbered list. Each question should be about 1 sentence.
    `.trim();

    const response = await callGemini(prompt);
    const questions = response
      .split('\n')
      .filter((line) => line.match(/^\d+\./))
      .map((line) => line.replace(/^\d+\.?\s*/, '').trim());

    return {
      success: true,
      questions: questions.slice(0, 5),
    };
  } catch (error) {
    console.error('[interviewCoachService getCommonQuestions]:', error.message);
    throw new Error('Failed to get questions: ' + error.message);
  }
}

/**
 * Call Google Gemini API
 * Placeholder implementation - use official SDK in production
 */
async function callGemini(prompt) {
  // In production, use the official Google Generative AI SDK
  // For now, return structured template responses

  if (prompt.includes("common interview questions")) {
    return `1. Tell me about yourself and how your background aligns with this role.
2. What are your key strengths and how do they apply to this position?
3. Describe your experience with [relevant technology/skill].
4. How do you approach problem-solving when faced with a challenging situation?
5. Why are you interested in joining our company?`;
  }

  return `ANSWER: I bring strong technical skills and a track record of delivering results. In my previous role, I [mentioned relevant achievement], which directly relates to the core responsibilities of this position. I'm excited about the opportunity to contribute to your team.

PRO TIP: Use the STAR method (Situation, Task, Action, Result) to structure your answer and provide concrete examples.

FEEDBACK: Avoid vague statements like "I'm a team player." Instead, demonstrate with specific examples. Make sure to show enthusiasm for the role and company.`;
}

/**
 * Parse coaching response into structured format
 */
function parseCoachingResponse(response) {
  const answerMatch = response.match(/ANSWER:\s*(.+?)(?=PRO TIP:|$)/is);
  const tipMatch = response.match(/PRO TIP:\s*(.+?)(?=FEEDBACK:|$)/is);
  const feedbackMatch = response.match(/FEEDBACK:\s*(.+?)$/is);

  return {
    answer: answerMatch ? answerMatch[1].trim() : response.trim(),
    tip: tipMatch ? tipMatch[1].trim() : "Practice your answer out loud to build confidence.",
    feedback: feedbackMatch
      ? feedbackMatch[1].trim()
      : "Keep your answer concise and relevant to the job requirements.",
  };
}

module.exports = {
  getInterviewCoaching,
  getCommonQuestions,
};

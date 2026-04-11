const { GoogleGenerativeAI } = require("@google/generative-ai");
const { env } = require("../config/env");
const { sanitizeEmailForAI } = require("../security/dlp");
const { logger } = require("../utils/logger");

/**
 * Generate an AI-powered cover letter for a job application
 * Elite tier only
 *
 * @param {string} jobTitle - Position title
 * @param {string} company - Company name
 * @param {string} jobDescription - Job description/requirements
 * @param {object} userProfile - User's profile (name, headline, experience, etc)
 * @returns {Promise<{coverLetter: string, wordCount: number}>}
 */
async function generateCoverLetter(jobTitle, company, jobDescription, userProfile = {}) {
  if (!env.GEMINI_API_KEY) {
    throw new Error('Gemini API not configured');
  }

  try {
    const sanitized = sanitizeEmailForAI(jobDescription);

    const prompt = `
You are an expert recruiter and cover letter writer. Generate a professional, personalized cover letter.

JOB DETAILS:
Title: ${jobTitle}
Company: ${company}
Requirements: ${sanitized}

APPLICANT PROFILE:
Name: ${userProfile.name || 'Applicant'}
Headline: ${userProfile.headline || 'Professional'}
Experience: ${userProfile.experience || 'Experienced professional'}

Generate a compelling 3-paragraph cover letter that:
1. Opens with enthusiasm for the specific role and company
2. Highlights relevant experience and skills that match the job requirements
3. Closes with a call to action and professional sign-off

Format as plain text. Keep it under 250 words.
    `.trim();

    const response = await callGemini(prompt);
    const coverLetter = response.trim();

    return {
      success: true,
      coverLetter,
      wordCount: coverLetter.split(/\s+/).length,
    };
  } catch (error) {
    logger.error('[coverLetterService] generation failed', { error: error.message });
    throw new Error('Failed to generate cover letter: ' + error.message);
  }
}

async function callGemini(prompt) {
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

module.exports = {
  generateCoverLetter,
};

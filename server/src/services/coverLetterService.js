const { env } = require("../config/env");
const { sanitizeEmailForAI } = require("../security/dataLossPrevention");

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
    console.error('[coverLetterService]:', error.message);
    throw new Error('Failed to generate cover letter: ' + error.message);
  }
}

/**
 * Call Google Gemini API
 * For production, use official Google Generative AI client
 * This is a placeholder implementation
 */
async function callGemini(prompt) {
  // In production:
  // const { GoogleGenerativeAI } = require("@google/generative-ai");
  // const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  // const result = await model.generateContent(prompt);
  // return result.response.text();

  // For now, return a template response
  return `Dear Hiring Manager,

I am excited to apply for the ${prompt.match(/Title: (.+)/)?.[1] || 'position'} role at ${prompt.match(/Company: (.+)/)?.[1] || 'your company'}. With my background in software development and passion for innovative solutions, I am confident I can deliver exceptional value to your team.

Throughout my career, I have consistently delivered high-quality solutions and collaborated effectively with cross-functional teams. The requirements outlined in your job description align perfectly with my expertise and professional goals.

I look forward to discussing how my skills and experience can contribute to your team's success. Thank you for considering my application.

Best regards,
${prompt.match(/Name: (.+)/)?.[1] || 'Applicant'}`;
}

module.exports = {
  generateCoverLetter,
};

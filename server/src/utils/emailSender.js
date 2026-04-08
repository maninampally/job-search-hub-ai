/**
 * Email Sender Utility
 * Handles sending emails via SMTP or console (development)
 * Uses nodemailer for SMTP email delivery
 */

const { env } = require('../config/env');

let nodemailer = null;
let transporter = null;

// Initialize nodemailer if available and SMTP is configured
try {
  nodemailer = require('nodemailer');
  
  const hasSmtpConfig = env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS;
  
  if (hasSmtpConfig) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
    
    console.log(`[emailSender] SMTP configured: ${env.SMTP_HOST}:${env.SMTP_PORT}`);
  } else {
    console.warn('[emailSender] SMTP not fully configured - OTP will be logged to console');
  }
} catch (error) {
  console.warn('[emailSender] nodemailer not available - OTP delivery disabled');
}

/**
 * Send OTP email to user
 * @param {string} recipientEmail - Email address to send OTP to
 * @param {string} otpCode - 6-digit OTP code
 * @param {string} recipientName - User name (optional, for personalization)
 * @param {string} emailType - 'registration' or 'extraction' 
 * @returns {Promise<Object>} Result with success status and message
 */
async function sendOTPEmail(recipientEmail, otpCode, recipientName = 'User', emailType = 'extraction') {
  // Validation
  if (!recipientEmail || !otpCode) {
    console.warn('[emailSender] Missing recipientEmail or otpCode');
    return {
      success: false,
      message: 'Missing email or OTP code'
    };
  }

  // In console/dev mode, just log the OTP
  if (env.OTP_SEND_MODE === 'console' || !transporter) {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                   OTP VERIFICATION CODE                    ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  Email:     ${recipientEmail.padEnd(49).substring(0, 49)}║
║  OTP Code:  ${otpCode.toString().padStart(45)}║
║  Type:      ${emailType.padEnd(45)}║
║  Expires:   15 minutes                                    ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
    
    return {
      success: true,
      message: 'OTP logged to console (development mode)',
      code: otpCode // Return code for testing purposes
    };
  }

  try {
    // Prepare email content based on type
    const subject = emailType === 'registration' 
      ? 'Job Search Hub - Verify Your Email' 
      : 'Job Search Hub - Email Extraction OTP';

    const htmlContent = generateEmailHTML(otpCode, recipientName, emailType);
    const textContent = generateEmailText(otpCode, recipientName, emailType);

    // Send email via SMTP
    const info = await transporter.sendMail({
      from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
      to: recipientEmail,
      subject: subject,
      text: textContent,
      html: htmlContent,
      replyTo: env.SMTP_FROM_EMAIL,
    });

    console.log(`[emailSender] Email sent successfully to ${recipientEmail} (messageId: ${info.messageId})`);

    return {
      success: true,
      message: 'OTP sent to your email',
      messageId: info.messageId
    };
  } catch (error) {
    console.error('[emailSender] Failed to send email:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response
    });
    return {
      success: false,
      message: 'Failed to send OTP email',
      error: error.message
    };
  }
}

/**
 * Generate HTML email content
 * @private
 */
function generateEmailHTML(otpCode, name, type) {
  const isRegistration = type === 'registration';
  const title = isRegistration ? 'Verify Your Email' : 'Email Extraction Verification';
  const description = isRegistration 
    ? 'Confirm your email address to complete your account registration'
    : 'Verify your email to enable email extraction feature';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Segoe UI, Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 40px 20px; }
    .content p { color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; }
    .otp-box { background: #f0f4ff; border: 2px solid #667eea; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0; }
    .otp-label { color: #666; font-size: 14px; margin-bottom: 10px; }
    .otp-code { font-size: 48px; font-weight: bold; color: #667eea; font-family: monospace; letter-spacing: 8px; margin: 20px 0; }
    .expiry { color: #999; font-size: 14px; margin-top: 10px; }
    .footer { background: #f9f9f9; padding: 20px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #eee; }
    .footer p { margin: 5px 0; }
    .warning { color: #d97706; background: #fffbeb; padding: 15px; border-radius: 5px; margin: 20px 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
    </div>
    <div class="content">
      <p>Hi ${name},</p>
      <p>${description}.</p>
      <p>Use the verification code below to proceed:</p>
      
      <div class="otp-box">
        <div class="otp-label">Verification Code</div>
        <div class="otp-code">${otpCode}</div>
        <div class="expiry">This code expires in 15 minutes</div>
      </div>

      <div class="warning">
        <strong>⚠️ Security Notice:</strong> Never share this code with anyone. Job Search Hub staff will never ask for your verification code.
      </div>

      <p>If you didn't request this code, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>&copy; 2026 Job Search Hub. All rights reserved.</p>
      <p>This is an automated message, please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate plain text email content
 * @private
 */
function generateEmailText(otpCode, name, type) {
  const isRegistration = type === 'registration';
  const title = isRegistration ? 'Verify Your Email' : 'Email Extraction Verification';
  const description = isRegistration 
    ? 'Confirm your email address to complete your account registration'
    : 'Verify your email to enable email extraction feature';

  return `
${title}
${'='.repeat(title.length)}

Hi ${name},

${description}.

Use the verification code below to proceed:

${otpCode}

This code expires in 15 minutes.

SECURITY NOTICE:
Never share this code with anyone. Job Search Hub staff will never ask for your verification code.

If you didn't request this code, you can safely ignore this email.

---
© 2026 Job Search Hub. All rights reserved.
This is an automated message, please do not reply to this email.
  `;
}

/**
 * Verify SMTP connection (for testing)
 * @returns {Promise<boolean>} True if SMTP is connected
 */
async function verifySmtpConnection() {
  if (!transporter) {
    console.warn('[emailSender] SMTP not configured');
    return false;
  }

  try {
    await transporter.verify();
    console.log('[emailSender] SMTP connection verified successfully');
    return true;
  } catch (error) {
    console.error('[emailSender] SMTP connection failed:', error.message);
    return false;
  }
}

module.exports = {
  sendOTPEmail,
  verifySmtpConnection,
};

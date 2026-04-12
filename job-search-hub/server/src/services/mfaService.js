const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { hashPassword, verifyPassword } = require('../utils/password');

/**
 * Generate a new TOTP secret and QR code URL
 * Returns: { secret, qrCodeUrl }
 */
async function generateMFASecret(userEmail, appName = 'Job Search Hub') {
  const secret = speakeasy.generateSecret({
    name: `${appName} (${userEmail})`,
    issuer: appName,
    length: 32,
  });

  // Generate QR code data URL
  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

  return {
    secret: secret.base32,
    qrCodeUrl,
    otpauthUrl: secret.otpauth_url,
  };
}

/**
 * Verify a TOTP code against the secret
 * Returns: boolean (true if valid)
 */
function verifyMFAToken(secret, token) {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 2, // Allow codes from 30 seconds before/after
  });
}

/**
 * Generate 8 backup codes (8 chars each, alphanumeric)
 * Codes are returned unhashed for display to user (shown once)
 * Hashed versions should be stored in DB
 * Returns: { codes: string[], hashes: string[] }
 */
function generateBackupCodes(count = 8) {
  const codes = [];
  const hashes = [];

  for (let i = 0; i < count; i++) {
    // Generate 8-char alphanumeric code
    const code = crypto
      .randomBytes(6)
      .toString('hex')
      .slice(0, 8)
      .toUpperCase();
    codes.push(code);

    // Hash the code for storage
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    hashes.push(hash);
  }

  return { codes, hashes };
}

/**
 * Verify a backup code against stored hashes
 * If valid, mark it as used (in the DB via the caller)
 * Returns: boolean (true if valid)
 */
function verifyBackupCode(code, codeHashes = []) {
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  // Return true if the hash is found in the list
  return codeHashes.includes(codeHash);
}

/**
 * Consume a backup code (remove from the list)
 * Takes the unhashed code and hashed list, returns updated hashed list
 */
function consumeBackupCode(code, codeHashes = []) {
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  return codeHashes.filter((h) => h !== codeHash);
}

module.exports = {
  generateMFASecret,
  verifyMFAToken,
  generateBackupCodes,
  verifyBackupCode,
  consumeBackupCode,
};

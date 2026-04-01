const crypto = require("crypto");

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(":")) {
    return false;
  }

  const [salt, savedHash] = storedHash.split(":");
  if (!salt || !savedHash) {
    return false;
  }

  const hashedBuffer = crypto.scryptSync(password, salt, 64);
  const savedBuffer = Buffer.from(savedHash, "hex");
  if (hashedBuffer.length !== savedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(hashedBuffer, savedBuffer);
}

module.exports = {
  hashPassword,
  verifyPassword,
};

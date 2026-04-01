const crypto = require("crypto");

function encodeBase64Url(value) {
  const source = typeof value === "string" ? value : JSON.stringify(value);
  return Buffer.from(source)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function decodeBase64Url(value) {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "===".slice((normalized.length + 3) % 4);
  return Buffer.from(padded, "base64").toString("utf-8");
}

function createAuthToken(payload, secret, ttlHours = 24) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const exp = nowSeconds + Number(ttlHours || 24) * 60 * 60;
  const header = { alg: "HS256", typ: "JWT" };
  const body = {
    ...payload,
    iat: nowSeconds,
    exp,
  };

  const encodedHeader = encodeBase64Url(header);
  const encodedBody = encodeBase64Url(body);
  const signingInput = `${encodedHeader}.${encodedBody}`;
  const signature = crypto
    .createHmac("sha256", String(secret || ""))
    .update(signingInput)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${signingInput}.${signature}`;
}

function verifyAuthToken(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedBody, signature] = parts;
  const signingInput = `${encodedHeader}.${encodedBody}`;
  const expectedSignature = crypto
    .createHmac("sha256", String(secret || ""))
    .update(signingInput)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedBody));
    if (!payload || typeof payload !== "object") {
      return null;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp <= nowSeconds) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  createAuthToken,
  verifyAuthToken,
};

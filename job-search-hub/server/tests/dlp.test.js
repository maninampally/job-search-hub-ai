import { describe, it, expect } from "vitest";
import { sanitizeEmailForAI, sanitizeEmailSubject } from "../src/security/dlp.js";

describe("sanitizeEmailForAI", () => {
  it("masks credit card numbers", () => {
    const input = "My card is 4111-1111-1111-1111 please process it";
    const result = sanitizeEmailForAI(input);
    expect(result).not.toContain("4111");
    expect(result).toContain("[REDACTED]");
  });

  it("masks SSN", () => {
    const input = "SSN: 123-45-6789";
    const result = sanitizeEmailForAI(input);
    expect(result).not.toContain("123-45-6789");
  });

  it("masks salary information", () => {
    const input = "salary: $120000 per year";
    const result = sanitizeEmailForAI(input);
    expect(result).toContain("[REDACTED]");
  });

  it("handles empty/null input", () => {
    expect(sanitizeEmailForAI("")).toBe("");
    expect(sanitizeEmailForAI(null)).toBe("");
    expect(sanitizeEmailForAI(undefined)).toBe("");
  });

  it("preserves safe content", () => {
    const input = "Looking forward to the interview next Tuesday";
    expect(sanitizeEmailForAI(input)).toBe(input);
  });
});

describe("sanitizeEmailSubject", () => {
  it("redacts confidential markers", () => {
    expect(sanitizeEmailSubject("[Confidential] Offer Letter")).toContain("[REDACTED]");
  });

  it("redacts salary mentions", () => {
    expect(sanitizeEmailSubject("Salary Discussion Follow-up")).toContain("[REDACTED]");
  });

  it("handles empty input", () => {
    expect(sanitizeEmailSubject("")).toBe("");
    expect(sanitizeEmailSubject(null)).toBe("");
  });
});

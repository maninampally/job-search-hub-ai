import { describe, it, expect } from "vitest";
import { escapeHtml, stripHtmlTags, sanitizeText, sanitizeObject } from "../src/utils/sanitize.js";

describe("escapeHtml", () => {
  it("escapes dangerous characters", () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;"
    );
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("passes through safe strings", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
  });

  it("handles non-string input", () => {
    expect(escapeHtml(null)).toBe(null);
    expect(escapeHtml(42)).toBe(42);
  });
});

describe("stripHtmlTags", () => {
  it("removes HTML tags", () => {
    expect(stripHtmlTags("<b>bold</b> text")).toBe("bold text");
  });

  it("removes nested tags", () => {
    expect(stripHtmlTags('<div><p class="x">text</p></div>')).toBe("text");
  });

  it("handles no tags", () => {
    expect(stripHtmlTags("plain text")).toBe("plain text");
  });
});

describe("sanitizeText", () => {
  it("strips tags and trims whitespace", () => {
    expect(sanitizeText("  <b>hello</b>  ")).toBe("hello");
  });
});

describe("sanitizeObject", () => {
  it("sanitizes specified fields", () => {
    const result = sanitizeObject(
      { name: "<script>bad</script>John", email: "user@test.com", bio: "  <i>italic</i>  " },
      ["name", "bio"]
    );
    expect(result.name).toBe("badJohn");
    expect(result.bio).toBe("italic");
    expect(result.email).toBe("user@test.com");
  });

  it("handles null input", () => {
    expect(sanitizeObject(null, ["name"])).toBe(null);
  });
});

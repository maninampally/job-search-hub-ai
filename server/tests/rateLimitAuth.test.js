import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, clearRateLimit } from "../src/middleware/rateLimitAuth.js";

describe("checkRateLimit", () => {
  beforeEach(() => {
    clearRateLimit("test-key");
  });

  it("allows first request", () => {
    const result = checkRateLimit("test-key", 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("allows up to max attempts", () => {
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit("test-key-max", 5, 60000);
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks after exceeding max attempts", () => {
    for (let i = 0; i < 6; i++) {
      checkRateLimit("test-key-block", 5, 60000);
    }
    const result = checkRateLimit("test-key-block", 5, 60000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets after window expires", () => {
    const shortWindow = 1; // 1ms
    checkRateLimit("test-key-expire", 1, shortWindow);
    // Wait just enough for window to pass
    const start = Date.now();
    while (Date.now() - start < 5) { /* spin */ }
    const result = checkRateLimit("test-key-expire", 1, shortWindow);
    expect(result.allowed).toBe(true);
  });
});

describe("clearRateLimit", () => {
  it("clears a specific key", () => {
    checkRateLimit("test-clear", 1, 60000);
    checkRateLimit("test-clear", 1, 60000);
    const blocked = checkRateLimit("test-clear", 1, 60000);
    expect(blocked.allowed).toBe(false);

    clearRateLimit("test-clear");
    const afterClear = checkRateLimit("test-clear", 1, 60000);
    expect(afterClear.allowed).toBe(true);
  });
});

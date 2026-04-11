import { describe, it, expect, vi, afterEach } from "vitest";

describe("getManualSyncLimitForRole", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns tier-specific manual sync limits", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("RATE_LIMIT_SYNC_FREE", "3");
    vi.stubEnv("RATE_LIMIT_SYNC_PRO", "12");
    vi.stubEnv("RATE_LIMIT_SYNC_ELITE", "30");
    vi.stubEnv("RATE_LIMIT_SYNC_ADMIN", "60");
    vi.resetModules();
    const { getManualSyncLimitForRole } = await import("../src/security/rateLimiter.js");
    expect(getManualSyncLimitForRole("free")).toBe(3);
    expect(getManualSyncLimitForRole("pro")).toBe(12);
    expect(getManualSyncLimitForRole("elite")).toBe(30);
    expect(getManualSyncLimitForRole("admin")).toBe(60);
    expect(getManualSyncLimitForRole(undefined)).toBe(3);
  });
});

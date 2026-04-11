import { describe, it, expect, vi, afterEach } from "vitest";

describe("requireTierGmailSync", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadMiddleware() {
    return import("../src/middleware/requireTier.js");
  }

  it("calls next for free user when ALLOW_FREE_TIER_GMAIL_SYNC is not false (dev default)", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ALLOW_FREE_TIER_GMAIL_SYNC", "");
    vi.resetModules();
    const { requireTierGmailSync } = await loadMiddleware();
    const next = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    requireTierGmailSync({ user: { role: "free", plan_expires: null } }, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 402 for free user when ALLOW_FREE_TIER_GMAIL_SYNC is false", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ALLOW_FREE_TIER_GMAIL_SYNC", "false");
    vi.resetModules();
    const { requireTierGmailSync } = await loadMiddleware();
    const next = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    requireTierGmailSync({ user: { role: "free", plan_expires: null } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "upgrade_required", min_tier: "pro", feature: "gmail_sync" })
    );
  });

  it("calls next for pro user when ALLOW_FREE_TIER_GMAIL_SYNC is false", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ALLOW_FREE_TIER_GMAIL_SYNC", "false");
    vi.resetModules();
    const { requireTierGmailSync } = await loadMiddleware();
    const next = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    requireTierGmailSync({ user: { role: "pro", plan_expires: null } }, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

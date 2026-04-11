import { describe, it, expect } from "vitest";
import { parseJobsSyncBody } from "../src/schemas/jobSyncSchemas.js";

describe("parseJobsSyncBody", () => {
  it("accepts valid sync payloads", () => {
    const a = parseJobsSyncBody({ forceReprocess: true, fullWindow: false });
    expect(a.success).toBe(true);
    expect(a.data.forceReprocess).toBe(true);

    const b = parseJobsSyncBody({ lookbackDays: 90 });
    expect(b.success).toBe(true);
    expect(b.data.lookbackDays).toBe(90);
  });

  it("rejects unknown keys", () => {
    const r = parseJobsSyncBody({ fullWindow: true, extra: 1 });
    expect(r.success).toBe(false);
  });

  it("rejects lookbackDays out of range", () => {
    expect(parseJobsSyncBody({ lookbackDays: 0 }).success).toBe(false);
    expect(parseJobsSyncBody({ lookbackDays: 400 }).success).toBe(false);
  });
});

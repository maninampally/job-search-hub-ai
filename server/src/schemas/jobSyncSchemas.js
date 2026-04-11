const { z } = require("zod");

/**
 * POST /jobs/sync body (strict: unknown keys rejected).
 */
const postJobsSyncBodySchema = z
  .object({
    forceReprocess: z.boolean().optional(),
    fullWindow: z.boolean().optional(),
    /** Gmail newer_than:Nd when set (1-365). Implies wide / initial-style sync. */
    lookbackDays: z.number().int().min(1).max(365).optional(),
    /** When true, do not cap by INITIAL/INCREMENTAL max; list all matching Gmail messages. */
    processAll: z.boolean().optional(),
  })
  .strict();

function parseJobsSyncBody(body) {
  return postJobsSyncBodySchema.safeParse(body ?? {});
}

module.exports = { postJobsSyncBodySchema, parseJobsSyncBody };

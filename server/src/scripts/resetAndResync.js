/**
 * Reset script: wipe jobs + related data for a user, reset lastChecked.
 *
 * Usage (inside container):
 *   node server/src/scripts/resetAndResync.js                     # reset ALL users
 *   node server/src/scripts/resetAndResync.js --user-id <uuid>    # reset one user
 *   node server/src/scripts/resetAndResync.js --dry-run            # preview only
 *
 * Environment:
 *   RESET_LOOKBACK_DAYS  - suggested lookback for re-sync (default 180)
 */
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");
const { env } = require("../config/env");

const LOOKBACK_DAYS = Number(process.env.RESET_LOOKBACK_DAYS || 180);

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = { dryRun: false, userId: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") flags.dryRun = true;
    if (args[i] === "--user-id" && args[i + 1]) {
      flags.userId = args[i + 1];
      i++;
    }
  }
  return flags;
}

async function resetUser(supabase, userId, dryRun) {
  console.log(`\n--- ${dryRun ? "[DRY RUN] " : ""}Resetting user: ${userId} ---`);

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id")
    .eq("owner_user_id", userId);

  const jobCount = jobs?.length || 0;

  if (dryRun) {
    console.log(`  Would delete ${jobCount} jobs + their emails, timeline, processed_emails`);
    console.log("  Would reset last_checked to null");
    return;
  }

  if (jobCount > 0) {
    const jobIds = jobs.map((j) => j.id);

    // Delete job_emails
    const { error: emailErr } = await supabase.from("job_emails").delete().in("job_id", jobIds);
    if (emailErr) console.warn(`  Warning: job_emails delete: ${emailErr.message}`);

    // Delete job_status_timeline
    const { error: tlErr } = await supabase.from("job_status_timeline").delete().in("job_id", jobIds);
    if (tlErr) console.warn(`  Warning: job_status_timeline delete: ${tlErr.message}`);

    console.log(`  Deleted emails + timeline for ${jobCount} jobs`);
  }

  // Delete jobs
  const { error: jobErr } = await supabase.from("jobs").delete().eq("owner_user_id", userId);
  if (jobErr) {
    console.error(`  Failed to delete jobs: ${jobErr.message}`);
  } else {
    console.log(`  Deleted ${jobCount} jobs`);
  }

  // Clear processed_emails
  const { error: procErr } = await supabase.from("processed_emails").delete().eq("owner_user_id", userId);
  if (procErr) console.warn(`  Warning: processed_emails delete: ${procErr.message}`);
  else console.log("  Cleared processed_emails tracking");

  // Reset last_checked
  const { error: lcErr } = await supabase
    .from("oauth_tokens")
    .update({ last_checked: null, updated_at: new Date().toISOString() })
    .eq("owner_user_id", userId);
  if (lcErr) console.warn(`  Warning: last_checked reset: ${lcErr.message}`);
  else console.log("  Reset last_checked to null");
}

async function main() {
  const { dryRun, userId: targetUserId } = parseArgs();

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    process.exit(1);
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  let userIds;
  if (targetUserId) {
    userIds = [targetUserId];
  } else {
    const { data: tokenRows, error: tokenErr } = await supabase
      .from("oauth_tokens")
      .select("owner_user_id");
    if (tokenErr) {
      console.error("Failed to query oauth_tokens:", tokenErr.message);
      process.exit(1);
    }
    if (!tokenRows || tokenRows.length === 0) {
      console.log("No users with OAuth tokens found. Nothing to reset.");
      process.exit(0);
    }
    userIds = tokenRows.map((r) => r.owner_user_id);
  }

  for (const uid of userIds) {
    await resetUser(supabase, uid, dryRun);
  }

  console.log(`\n=== ${dryRun ? "Dry run" : "Reset"} complete for ${userIds.length} user(s) ===`);
  if (!dryRun) {
    console.log(`Run a sync from the UI (e.g. "Sync 6M") or POST /jobs/sync with:`);
    console.log(`  { "fullWindow": true, "lookbackDays": ${LOOKBACK_DAYS}, "processAll": true }`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Reset script failed:", err);
  process.exit(1);
});

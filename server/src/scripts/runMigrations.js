#!/usr/bin/env node

/**
 * Migration Runner
 * Runs all SQL migration files from docs/database/ in order.
 * Tracks which migrations have been applied via a migrations table.
 *
 * Usage: node server/src/scripts/runMigrations.js
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../docs/database");

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Create migrations tracking table
  const { error: initError } = await supabase.rpc("exec_sql", {
    sql_query: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
  });

  if (initError) {
    console.error("Could not create migrations table:", initError.message);
    console.log("Ensure an exec_sql RPC function exists in your Supabase project.");
    process.exit(1);
  }

  // Get applied migrations
  const { data: applied } = await supabase
    .from("schema_migrations")
    .select("name")
    .order("name");
  const appliedSet = new Set((applied || []).map((r) => r.name));

  // Read migration files
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let ran = 0;
  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  skip: ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    console.log(`  run:  ${file}`);

    const { error } = await supabase.rpc("exec_sql", { sql_query: sql });
    if (error) {
      console.error(`  FAILED: ${file}:`, error.message);
      process.exit(1);
    }

    await supabase.from("schema_migrations").insert({ name: file });
    ran++;
  }

  console.log(`\nMigrations complete: ${ran} new, ${files.length - ran} skipped.`);
}

main().catch((err) => {
  console.error("Migration runner failed:", err);
  process.exit(1);
});

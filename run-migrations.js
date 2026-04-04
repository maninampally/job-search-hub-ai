#!/usr/bin/env node

/**
 * Database Migration Runner
 * Usage: node run-migrations.js [migration-number]
 * 
 * Note: For Supabase, you can also run migrations directly via:
 * 1. Supabase CLI: supabase migration up
 * 2. Direct SQL: Copy the migration SQL and run in Supabase Dashboard (SQL editor)
 * 3. Manual: Connect with psql and run the SQL files
 * 
 * This script is a helper for local development.
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config();

const MIGRATIONS_DIR = path.join(__dirname, "docs", "database");

function displayMigrationInfo(migrationNumber) {
  const migrationFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(f => f.match(new RegExp(`^${String(migrationNumber).padStart(3, "0")}_.*\\.sql$`)));

  if (migrationFiles.length === 0) {
    console.log(`No migration files found for ${migrationNumber}`);
    return null;
  }

  const migrationFile = migrationFiles[0];
  const migrationPath = path.join(MIGRATIONS_DIR, migrationFile);
  const sql = fs.readFileSync(migrationPath, "utf-8");

  return { migrationFile, migrationPath, sql };
}

function main() {
  const arg = process.argv[2];
  const migrationNumber = arg ? parseInt(arg, 10) : null;

  if (migrationNumber) {
    const info = displayMigrationInfo(migrationNumber);
    if (info) {
      console.log(`\n📋 Migration ${migrationNumber}: ${info.migrationFile}\n`);
      console.log("🔧 SQL to execute:\n");
      console.log(info.sql);
      console.log("\n" + "=".repeat(80));
      console.log("ℹ️  To run this migration:");
      console.log("  1. Go to Supabase Dashboard > SQL Editor");
      console.log("  2. Create new query");
      console.log("  3. Paste the SQL above");
      console.log("  4. Click 'Run' button");
      console.log("=".repeat(80) + "\n");
    }
  } else {
    console.log("\n📚 Pending Migrations:");
    const migrations = [8, 9];
    
    for (const num of migrations) {
      const info = displayMigrationInfo(num);
      if (info) {
        console.log(`\n[${num}] ${info.migrationFile}`);
        // Show first 3 lines of SQL
        const lines = info.sql.split("\n").slice(0, 3);
        lines.forEach(line => {
          if (line.trim() && !line.startsWith("--")) {
            console.log(`    ${line.substring(0, 70)}`);
          }
        });
      }
    }

    console.log("\n💡 Usage:");
    console.log("  node run-migrations.js 008  - View migration 008 SQL");
    console.log("  node run-migrations.js 009  - View migration 009 SQL");
    console.log("\n✅ Steps to apply migrations:");
    console.log("  1. node run-migrations.js 008  (copy SQL)");
    console.log("  2. Paste in Supabase SQL Editor and run");
    console.log("  3. node run-migrations.js 009  (copy SQL)");
    console.log("  4. Paste in Supabase SQL Editor and run\n");
  }
}

main();

#!/usr/bin/env node
/**
 * Quick script to upgrade user to Pro tier
 * Run with: node update-tier.js
 */

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function upgradeUserToPro() {
  try {
    console.log("🔍 Finding your user...");
    const { data: users, error: userError } = await supabase
      .from("app_users")
      .select("id, email")
      .limit(1);

    if (userError || !users || users.length === 0) {
      console.error("❌ Error: Could not find user", userError);
      process.exit(1);
    }

    const userId = users[0].id;
    const email = users[0].email;

    console.log(`✅ Found user: ${email}`);
    console.log(`🚀 Upgrading to Pro tier...`);

    // Update or insert user plan
    const { error: updateError } = await supabase
      .from("user_plans")
      .upsert(
        {
          user_id: userId,
          role: "pro",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (updateError) {
      console.error("❌ Error updating user plan:", updateError);
      process.exit(1);
    }

    console.log("✅ Success! Your account is now Pro tier");
    console.log("🔄 Please restart Docker: docker compose down && docker compose up -d");
    console.log("💡 Then go to Settings → Gmail Sync → Sync Now to create jobs!");
  } catch (error) {
    console.error("❌ Unexpected error:", error.message);
    process.exit(1);
  }
}

upgradeUserToPro();

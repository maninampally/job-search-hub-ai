/**
 * Database Adapter
 * Provides a unified interface for database operations using Supabase
 * Translates simple SQL queries to Supabase query builder calls
 */

const { createClient } = require("@supabase/supabase-js");
const { env } = require("../config/env");

const hasSupabase = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
const supabase = hasSupabase ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY) : null;

/**
 * Execute simple SQL queries using Supabase client
 * Supports SELECT, INSERT, UPDATE, DELETE with parameterized queries
 * @param {string} sql - SQL query with $1, $2 placeholders
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Result object with { rows: [], rowCount: 0 }
 */
async function query(sql, params = []) {
  if (!supabase) {
    console.warn("Supabase not configured - using demo mode");
    return { rows: [], rowCount: 0 };
  }

  try {
    const sqlUpper = sql.toUpperCase().trim();

    // DELETE query: DELETE FROM table WHERE condition
    if (sqlUpper.startsWith("DELETE FROM")) {
      const tableMatch = sql.match(/DELETE FROM\s+(\w+)/i);
      const tableName = tableMatch?.[1];
      if (!tableName) throw new Error("Cannot parse DELETE query table");

      let q = supabase.from(tableName).delete();

      // Apply WHERE filters
      if (sql.includes("user_id = $1")) q = q.eq("user_id", params[0]);
      if (sql.includes("expires_at < now()")) q = q.lt("expires_at", new Date().toISOString());

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data || [], rowCount: count || 0 };
    }

    // SELECT query
    if (sqlUpper.startsWith("SELECT")) {
      // Extract table name from FROM clause
      const tableMatch = sql.match(/FROM\s+(\w+)/i);
      const tableName = tableMatch?.[1];
      if (!tableName) throw new Error("Cannot parse SELECT query table");

      let q = supabase.from(tableName).select("*");

      // Parse and apply WHERE conditions
      for (let i = 0; i < params.length; i++) {
        const paramNum = `\\$${i + 1}`;
        if (sql.match(new RegExp(`id = ${paramNum}`))) q = q.eq("id", params[i]);
        else if (sql.match(new RegExp(`user_id = ${paramNum}`))) q = q.eq("user_id", params[i]);
        else if (sql.match(new RegExp(`code = ${paramNum}`))) q = q.eq("code", params[i]);
        else if (sql.match(new RegExp(`token = ${paramNum}`))) q = q.eq("token", params[i]);
        else if (sql.match(new RegExp(`email = ${paramNum}`))) q = q.eq("email", params[i]);
      }

      // Handle comparison filters
      if (sql.includes("created_at > now()")) {
        const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
        q = q.gt("created_at", oneMinuteAgo);
      }
      if (sql.includes("expires_at < now()")) {
        q = q.lt("expires_at", new Date().toISOString());
      }

      // Handle ORDER BY
      const orderMatch = sql.match(/ORDER BY\s+(\w+)\s+(DESC|ASC)?/i);
      if (orderMatch) {
        const ascending = !orderMatch[2] || orderMatch[2].toUpperCase() === "ASC";
        q = q.order(orderMatch[1], { ascending });
      }

      // Handle LIMIT
      const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
      if (limitMatch) {
        const limit = parseInt(limitMatch[1], 10);
        q = q.limit(limit);
      }

      const { data, error } = await q;
      if (error) throw error;
      return { rows: data || [], rowCount: (data || []).length };
    }

    // INSERT query
    if (sqlUpper.startsWith("INSERT INTO")) {
      const tableMatch = sql.match(/INSERT INTO\s+(\w+)\s*\(([^)]+)\)/i);
      const tableName = tableMatch?.[1];
      const columns = tableMatch?.[2]?.split(",").map(c => c.trim());

      if (!tableName || !columns) throw new Error("Cannot parse INSERT query");

      const record = {};
      columns.forEach((col, idx) => {
        record[col] = params[idx];
      });

      const { data, error } = await supabase
        .from(tableName)
        .insert([record])
        .select("*");

      if (error) throw error;
      return { rows: data || [], rowCount: (data || []).length };
    }

    // UPDATE query
    if (sqlUpper.startsWith("UPDATE")) {
      const tableMatch = sql.match(/UPDATE\s+(\w+)\s+SET/i);
      const tableName = tableMatch?.[1];
      if (!tableName) throw new Error("Cannot parse UPDATE query");

      // Parse SET clause
      const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i);
      const setClauses = setMatch?.[1]?.split(",").map(s => s.trim()) || [];

      const updates = {};
      let paramIdx = 0;

      setClauses.forEach(clause => {
        const [col] = clause.split("=").map(p => p.trim());
        if (col) updates[col] = params[paramIdx++];
      });

      let q = supabase.from(tableName).update(updates);

      // Apply WHERE conditions
      if (sql.includes("id = $")) q = q.eq("id", params[paramIdx]);
      else if (sql.includes("user_id = $")) q = q.eq("user_id", params[paramIdx]);

      const { data, error } = await q.select("*");
      if (error) throw error;
      return { rows: data || [], rowCount: (data || []).length };
    }

    throw new Error(`Unsupported SQL query type: ${sql.substring(0, 50)}`);
  } catch (error) {
    console.error("Database adapter error:", error.message, "SQL:", sql.substring(0, 100));
    throw error;
  }
}

module.exports = { query };

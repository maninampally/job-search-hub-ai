/**
 * Database Adapter
 * Provides a unified interface for database operations using Supabase.
 * Supports both simple Supabase query builder calls and direct SQL via rpc.
 */

const { createClient } = require("@supabase/supabase-js");
const { env } = require("../config/env");
const { logger } = require("../utils/logger");

const hasSupabase = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
const supabase = hasSupabase ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY) : null;

/**
 * Execute SQL queries using Supabase client.
 * For complex queries (JOINs, GROUP BY, aggregates, RETURNING, ON CONFLICT),
 * falls back to Supabase's rpc or direct REST as needed.
 */
async function query(sql, params = []) {
  if (!supabase) {
    logger.warn("Supabase not configured - query returning empty result");
    return { rows: [], rowCount: 0 };
  }

  try {
    const sqlTrimmed = sql.trim();
    const sqlUpper = sqlTrimmed.toUpperCase();

    const isComplex =
      sqlUpper.includes("JOIN") ||
      sqlUpper.includes("GROUP BY") ||
      sqlUpper.includes("COUNT(") ||
      sqlUpper.includes("SUM(") ||
      sqlUpper.includes("AVG(") ||
      sqlUpper.includes("ILIKE") ||
      sqlUpper.includes("ON CONFLICT") ||
      sqlUpper.includes("RETURNING") ||
      sqlUpper.includes("DATE(") ||
      sqlUpper.includes("COALESCE") ||
      (sqlUpper.includes("WHERE") && sqlUpper.includes("AND") && params.length > 2);

    if (isComplex) {
      return await executeViaRpc(sqlTrimmed, params);
    }

    if (sqlUpper.startsWith("SELECT")) return await executeSelect(sqlTrimmed, params);
    if (sqlUpper.startsWith("INSERT")) return await executeInsert(sqlTrimmed, params);
    if (sqlUpper.startsWith("UPDATE")) return await executeUpdate(sqlTrimmed, params);
    if (sqlUpper.startsWith("DELETE")) return await executeDelete(sqlTrimmed, params);

    return await executeViaRpc(sqlTrimmed, params);
  } catch (error) {
    logger.error("Database adapter error", { error: error.message, sql: sql.substring(0, 120) });
    throw error;
  }
}

/**
 * Execute complex queries via Supabase .rpc() calling a generic SQL executor,
 * or fall back to the simple query builder with best-effort parsing.
 */
async function executeViaRpc(sql, params) {
  // Replace $1, $2, etc. with actual values for Supabase REST
  let resolvedSql = sql;
  params.forEach((val, i) => {
    const placeholder = `$${i + 1}`;
    const escapedVal = typeof val === "string" ? `'${val.replace(/'/g, "''")}'` : val === null ? "NULL" : String(val);
    resolvedSql = resolvedSql.split(placeholder).join(escapedVal);
  });

  // Try rpc call to a generic SQL function if available
  try {
    const { data, error } = await supabase.rpc("exec_sql", { query_text: resolvedSql });
    if (!error) {
      const rows = Array.isArray(data) ? data : [];
      return { rows, rowCount: rows.length };
    }
    // If the function doesn't exist, fall through to simple parsing
    if (
      (!error.message?.includes("function") || !error.message?.includes("does not exist")) &&
      !error.message?.includes("Could not find the function public.exec_sql")
    ) {
      throw error;
    }
  } catch (rpcError) {
    if (
      rpcError.message?.includes("does not exist") ||
      rpcError.message?.includes("Could not find the function public.exec_sql")
    ) {
      // exec_sql function not available, fall through
    } else {
      throw rpcError;
    }
  }

  // Fallback: best-effort simple parsing for the most common complex patterns
  return await fallbackComplexQuery(sql, params);
}

async function fallbackComplexQuery(sql, params) {
  const sqlUpper = sql.toUpperCase().trim();

  // Handle INSERT ... ON CONFLICT
  if (sqlUpper.startsWith("INSERT") && sqlUpper.includes("ON CONFLICT")) {
    return await handleUpsert(sql, params);
  }

  // Handle regular INSERT when exec_sql RPC is unavailable
  if (sqlUpper.startsWith("INSERT")) {
    return await executeInsert(sql, params);
  }

  // Handle UPDATE with NOW() or complex SET clauses
  if (sqlUpper.startsWith("UPDATE")) {
    return await executeUpdate(sql, params);
  }

  // Handle simple SELECT with additional features
  if (sqlUpper.startsWith("SELECT")) {
    return await executeSelect(sql, params);
  }

  logger.warn("Unsupported complex SQL - returning empty result", { sql: sql.substring(0, 100) });
  return { rows: [], rowCount: 0 };
}

async function handleUpsert(sql, params) {
  const tableMatch = sql.match(/INSERT INTO\s+(\w+)\s*\(([^)]+)\)/i);
  if (!tableMatch) throw new Error("Cannot parse INSERT table for upsert");

  const tableName = tableMatch[1];
  const columns = tableMatch[2].split(",").map((c) => c.trim());

  // Build values from params, handling NOW() and NULL
  const record = {};
  const valuesMatch = sql.match(/VALUES\s*\(([^)]+)\)/i);
  if (valuesMatch) {
    const valuePlaceholders = valuesMatch[1].split(",").map((v) => v.trim());
    let paramIdx = 0;
    valuePlaceholders.forEach((vp, idx) => {
      const col = columns[idx];
      if (!col) return;
      if (vp.toUpperCase() === "NOW()") {
        record[col] = new Date().toISOString();
      } else if (vp.match(/^\$\d+$/)) {
        record[col] = params[paramIdx++];
      } else {
        record[col] = vp.replace(/'/g, "");
      }
    });
  }

  // Parse ON CONFLICT ... DO UPDATE SET
  const conflictMatch = sql.match(/ON CONFLICT\s*\((\w+)\)\s*DO UPDATE SET\s+(.+?)(?:;|$)/is);
  if (conflictMatch) {
    const conflictCol = conflictMatch[1];
    const { data, error } = await supabase.from(tableName).upsert(record, { onConflict: conflictCol }).select("*");
    if (error) throw error;
    return { rows: data || [], rowCount: (data || []).length };
  }

  const { data, error } = await supabase.from(tableName).upsert(record).select("*");
  if (error) throw error;
  return { rows: data || [], rowCount: (data || []).length };
}

async function executeSelect(sql, params) {
  const tableMatch = sql.match(/FROM\s+(\w+)/i);
  if (!tableMatch) throw new Error("Cannot parse SELECT table");
  const tableName = tableMatch[1];

  // Determine columns
  const colMatch = sql.match(/SELECT\s+(.+?)\s+FROM/i);
  const selectCols = colMatch?.[1]?.trim() === "*" ? "*" : colMatch?.[1]?.trim() || "*";

  let q = supabase.from(tableName).select(selectCols === "*" ? "*" : selectCols);

  // Parse WHERE conditions
  q = applyWhereConditions(q, sql, params);

  // Handle ORDER BY
  const orderMatch = sql.match(/ORDER BY\s+(\w+)\s+(DESC|ASC)?/i);
  if (orderMatch) {
    q = q.order(orderMatch[1], { ascending: !orderMatch[2] || orderMatch[2].toUpperCase() === "ASC" });
  }

  // Handle LIMIT
  const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
  if (limitMatch) {
    q = q.limit(parseInt(limitMatch[1], 10));
  }

  // Handle OFFSET
  const offsetMatch = sql.match(/OFFSET\s+(\d+)/i);
  if (offsetMatch) {
    q = q.range(parseInt(offsetMatch[1], 10), parseInt(offsetMatch[1], 10) + (limitMatch ? parseInt(limitMatch[1], 10) - 1 : 999));
  }

  const { data, error } = await q;
  if (error) throw error;
  return { rows: data || [], rowCount: (data || []).length };
}

async function executeInsert(sql, params) {
  const tableMatch = sql.match(/INSERT INTO\s+(\w+)\s*\(([^)]+)\)/i);
  if (!tableMatch) throw new Error("Cannot parse INSERT query");

  const tableName = tableMatch[1];
  const columns = tableMatch[2].split(",").map((c) => c.trim());

  const record = {};
  let paramIdx = 0;
  const valuesMatch = sql.match(/VALUES\s*\(([^)]+)\)/i);
  if (valuesMatch) {
    const valuePlaceholders = valuesMatch[1].split(",").map((v) => v.trim());
    valuePlaceholders.forEach((vp, idx) => {
      const col = columns[idx];
      if (!col) return;
      if (vp.toUpperCase() === "NOW()") {
        record[col] = new Date().toISOString();
      } else if (vp.match(/^\$\d+$/)) {
        record[col] = params[paramIdx++];
      } else {
        record[col] = vp.replace(/'/g, "");
      }
    });
  } else {
    columns.forEach((col, idx) => {
      record[col] = params[idx];
    });
  }

  const { data, error } = await supabase.from(tableName).insert([record]).select("*");
  if (error) throw error;
  return { rows: data || [], rowCount: (data || []).length };
}

async function executeUpdate(sql, params) {
  const tableMatch = sql.match(/UPDATE\s+(\w+)\s+SET/i);
  if (!tableMatch) throw new Error("Cannot parse UPDATE query");
  const tableName = tableMatch[1];

  const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i);
  if (!setMatch) throw new Error("Cannot parse UPDATE SET clause");
  const setClauses = setMatch[1].split(",").map((s) => s.trim());

  const updates = {};
  let paramIdx = 0;

  setClauses.forEach((clause) => {
    const eqIndex = clause.indexOf("=");
    if (eqIndex < 0) return;
    const col = clause.substring(0, eqIndex).trim();
    const val = clause.substring(eqIndex + 1).trim();

    if (val.toUpperCase() === "NOW()") {
      updates[col] = new Date().toISOString();
    } else if (val === "NULL") {
      updates[col] = null;
    } else if (val.match(/^\$\d+$/)) {
      updates[col] = params[paramIdx++];
    } else if (val.startsWith("'") && val.endsWith("'")) {
      updates[col] = val.slice(1, -1);
    } else {
      updates[col] = params[paramIdx++];
    }
  });

  let q = supabase.from(tableName).update(updates);

  // Apply WHERE conditions for UPDATE (remaining params)
  const whereMatch = sql.match(/WHERE\s+(.+?)(?:;|$)/i);
  if (whereMatch) {
    const whereStr = whereMatch[1];
    const conditions = whereStr.split(/\s+AND\s+/i);
    conditions.forEach((cond) => {
      const condMatch = cond.match(/(\w+)\s*=\s*\$(\d+)/);
      if (condMatch) {
        q = q.eq(condMatch[1], params[parseInt(condMatch[2], 10) - 1]);
      }
    });
  }

  const { data, error } = await q.select("*");
  if (error) throw error;
  return { rows: data || [], rowCount: (data || []).length };
}

async function executeDelete(sql, params) {
  const tableMatch = sql.match(/DELETE FROM\s+(\w+)/i);
  if (!tableMatch) throw new Error("Cannot parse DELETE table");
  const tableName = tableMatch[1];

  let q = supabase.from(tableName).delete();
  q = applyWhereConditions(q, sql, params);

  const { data, error } = await q;
  if (error) throw error;
  return { rows: data || [], rowCount: (data || []).length };
}

function applyWhereConditions(q, sql, params) {
  const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s+GROUP|\s+OFFSET|;|$)/i);
  if (!whereMatch) return q;

  const whereStr = whereMatch[1];
  const conditions = whereStr.split(/\s+AND\s+/i);

  conditions.forEach((cond) => {
    const trimmed = cond.trim();

    // expires_at > now() / expires_at < now()
    if (trimmed.match(/(\w+)\s*>\s*now\(\)/i)) {
      const col = trimmed.match(/(\w+)\s*>/i)[1];
      q = q.gt(col, new Date().toISOString());
      return;
    }
    if (trimmed.match(/(\w+)\s*<\s*now\(\)/i)) {
      const col = trimmed.match(/(\w+)\s*</i)[1];
      q = q.lt(col, new Date().toISOString());
      return;
    }

    // column = $N
    const eqMatch = trimmed.match(/(\w+)\s*=\s*\$(\d+)/);
    if (eqMatch) {
      q = q.eq(eqMatch[1], params[parseInt(eqMatch[2], 10) - 1]);
      return;
    }

    // column ILIKE $N
    const ilikeMatch = trimmed.match(/(\w+)\s+ILIKE\s+\$(\d+)/i);
    if (ilikeMatch) {
      q = q.ilike(ilikeMatch[1], params[parseInt(ilikeMatch[2], 10) - 1]);
      return;
    }
  });

  return q;
}

module.exports = { query };

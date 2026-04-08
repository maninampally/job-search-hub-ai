const express = require("express");
const { query: dbQuery } = require("../services/dbAdapter");

const adminRoutes = express.Router();

// GET /admin/users - paginated user list
adminRoutes.get("/users", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const limit = Math.min(100, parseInt(req.query.limit || "20", 10));
  const offset = (page - 1) * limit;
  const search = String(req.query.search || "").trim();

  try {
    let rows, total;
    if (search) {
      const result = await dbQuery(
        `SELECT id, email, name, role, plan_expires, created_at, suspended_at
         FROM app_users WHERE email ILIKE $1 OR name ILIKE $1
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [`%${search}%`, limit, offset]
      );
      const countResult = await dbQuery(
        `SELECT COUNT(*) FROM app_users WHERE email ILIKE $1 OR name ILIKE $1`,
        [`%${search}%`]
      );
      rows = result.rows;
      total = parseInt(countResult.rows[0].count, 10);
    } else {
      const result = await dbQuery(
        `SELECT id, email, name, role, plan_expires, created_at, suspended_at
         FROM app_users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      const countResult = await dbQuery(`SELECT COUNT(*) FROM app_users`);
      rows = result.rows;
      total = parseInt(countResult.rows[0].count, 10);
    }
    return res.json({ users: rows || [], total, page, limit });
  } catch (err) {
    return res.status(500).json({ error: "Failed to list users", details: err.message });
  }
});

// PATCH /admin/users/:id/role
adminRoutes.patch("/users/:id/role", async (req, res) => {
  const { role } = req.body;
  const validRoles = ["free", "pro", "elite", "admin"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: "Invalid role", validRoles });
  }
  try {
    await dbQuery(
      `INSERT INTO user_plans (user_id, role, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET role = $2, updated_at = NOW()`,
      [req.params.id, role]
    );
    await dbQuery(`UPDATE app_users SET role = $1 WHERE id = $2`, [role, req.params.id]).catch(() => {});
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update role", details: err.message });
  }
});

// POST /admin/users/:id/suspend
adminRoutes.post("/users/:id/suspend", async (req, res) => {
  try {
    await dbQuery(`UPDATE app_users SET suspended_at = NOW() WHERE id = $1`, [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to suspend user", details: err.message });
  }
});

// POST /admin/users/:id/unsuspend
adminRoutes.post("/users/:id/unsuspend", async (req, res) => {
  try {
    await dbQuery(`UPDATE app_users SET suspended_at = NULL WHERE id = $1`, [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to unsuspend", details: err.message });
  }
});

// GET /admin/audit-log
adminRoutes.get("/audit-log", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const limit = Math.min(100, parseInt(req.query.limit || "50", 10));
  const offset = (page - 1) * limit;
  try {
    const result = await dbQuery(
      `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const countResult = await dbQuery(`SELECT COUNT(*) FROM audit_log`);
    return res.json({
      events: result.rows || [],
      total: parseInt(countResult.rows[0].count, 10),
      page,
      limit,
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch audit log", details: err.message });
  }
});

// GET /admin/metrics
adminRoutes.get("/metrics", async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const [totalRes, proRes, eliteRes, aiRes, syncRes] = await Promise.all([
      dbQuery(`SELECT COUNT(*) FROM app_users`),
      dbQuery(`SELECT COUNT(*) FROM app_users WHERE role = 'pro'`),
      dbQuery(`SELECT COUNT(*) FROM app_users WHERE role = 'elite'`),
      dbQuery(`SELECT COUNT(*) FROM ai_usage WHERE DATE(created_at) = $1`, [today]).catch(() => ({ rows: [{ count: 0 }] })),
      dbQuery(`SELECT COUNT(*) FROM audit_log WHERE action = 'sync' AND DATE(created_at) = $1`, [today]).catch(() => ({ rows: [{ count: 0 }] })),
    ]);
    return res.json({
      totalUsers: parseInt(totalRes.rows[0].count, 10),
      proUsers: parseInt(proRes.rows[0].count, 10),
      eliteUsers: parseInt(eliteRes.rows[0].count, 10),
      aiCallsToday: parseInt(aiRes.rows[0].count, 10),
      syncCallsToday: parseInt(syncRes.rows[0].count, 10),
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch metrics", details: err.message });
  }
});

module.exports = { adminRoutes };

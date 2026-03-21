const express = require("express");

const healthRoutes = express.Router();

healthRoutes.get("/", (req, res) => {
  res.json({ status: "ok", version: "1.0.0" });
});

module.exports = { healthRoutes };

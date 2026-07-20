const express = require("express");
const router = express.Router();
const { getDashboardStats } = require("../controllers/dashboardController");
const { optionalAuth } = require("../middleware/auth");

router.get("/dashboard", optionalAuth, getDashboardStats);

module.exports = router;

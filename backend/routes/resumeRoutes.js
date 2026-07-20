const express = require("express");
const router = express.Router();
const { uploadResume } = require("../middleware/upload");
const { analyzeResume, requestMoreMatches, getResumeUsage } = require("../controllers/resumeController");
const { protect } = require("../middleware/auth");

// Resume analysis is a private, per-account feature — guests are sent to
// /login by the frontend before they ever reach this page, and `protect`
// is the server-side backstop for that rule.
router.get("/resume/usage", protect, getResumeUsage);
router.post("/resume", protect, uploadResume.single("resume"), analyzeResume);
router.post("/resume/:id/matches", protect, requestMoreMatches);

module.exports = router;

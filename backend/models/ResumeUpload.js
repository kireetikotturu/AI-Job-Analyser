const mongoose = require("mongoose");

const RecommendedJobSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
    jobTitle: String,
    company: String,
    jobType: String,
    atsScore: Number,
    matchPercent: Number,
    matchedSkills: [String],
    missingSkills: [String],
    applyLink: String,
  },
  { _id: false }
);

const ResumeUploadSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    extractedText: { type: String, default: "" },
    overallAtsScore: { type: Number, default: 0 },
    suggestedImprovements: { type: [String], default: [] },
    recommendedJobs: { type: [RecommendedJobSchema], default: [] },

    // Progressive job-match system: how many total matches this analysis
    // has unlocked so far. Basic plan caps at 20 (5 -> 10 -> 15 -> 20);
    // Pro plan can request 20/40/60/80/100 directly, each a fresh re-run.
    matchesUnlocked: { type: Number, default: 0 },

    // Ownership — every resume analysis now requires a signed-in account
    // (guests are redirected to Login before they can upload a resume),
    // so `user` is always set going forward. Kept optional for backward
        // compatibility with any pre-existing anonymous rows.
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    anonId: { type: String, default: null, index: true },

    // The actual uploaded file is only kept on disk for signed-in users
    // (so History can offer a real download + re-run). Anonymous uploads
    // are still deleted right after analysis, same as before.
    storedFileName: { type: String, default: null }, // name on disk in /uploads
    originalFileName: { type: String, default: null }, // name to show/download as
  },
  { timestamps: true }
);

module.exports = mongoose.model("ResumeUpload", ResumeUploadSchema);

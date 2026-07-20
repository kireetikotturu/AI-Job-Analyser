const mongoose = require("mongoose");

const JOB_TYPES = [
  "Python Full Stack",
  "Python Developer",
  "Java Full Stack",
  "MERN Stack Developer",
  "AI Engineer",
  "Data Scientist",
  "Data Analyst",
  "DevOps Engineer",
  "Other",
];

const JobSchema = new mongoose.Schema(
  {
    jobTitle: { type: String, required: true, trim: true, index: true },
    company: { type: String, required: true, trim: true, index: true },
    location: { type: String, trim: true, default: "Not specified", index: true },
    salary: { type: String, trim: true, default: "Not disclosed" },
    salaryMin: { type: Number, default: null },
    salaryMax: { type: Number, default: null },
    experience: { type: String, trim: true, default: "Not specified" },
    skills: { type: [String], default: [] },
    description: { type: String, trim: true, default: "" },
    employmentType: {
      type: String,
      trim: true,
      default: "Full-time",
    },
    industry: { type: String, trim: true, default: "Technology" },
    education: { type: String, trim: true, default: "Not specified" },
    jobType: {
      type: String,
      enum: JOB_TYPES,
      default: "Other",
      index: true,
    },
    applyLink: { type: String, trim: true, default: "" },
    postedDate: { type: Date, default: Date.now },
    source: { type: String, trim: true, default: "Excel Upload" },
    remote: { type: Boolean, default: false },

    // --- Ownership / data isolation ---
    // `owner` is set for every job uploaded by a signed-in user; that user
    // is the ONLY one who can ever see these rows (Dashboard, All Jobs,
    // Resume Analyzer). `isSample` marks the public demo dataset shown to
    // guests (owner is always null for those rows). A job document is
    // never both owned AND sample — exactly one of the two identifies who
    // can see it.
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    isSample: { type: Boolean, default: false, index: true },
    // Which JobDataset (upload batch) this row came from — lets History
    // "reactivate" a past upload by owner + dataset without needing the
    // file re-uploaded.
    dataset: { type: mongoose.Schema.Types.ObjectId, ref: "JobDataset", default: null, index: true },
  },
  { timestamps: true }
);

JobSchema.index({ jobTitle: "text", company: "text", skills: "text", description: "text" });
// Compound index used for de-duplication checks during bulk import
JobSchema.index({ jobTitle: 1, company: 1, location: 1 });
// Every list/dashboard query is scoped by owner (or isSample) first —
// this is the primary access-control filter so it needs its own index.
JobSchema.index({ owner: 1, isSample: 1 });

module.exports = mongoose.model("Job", JobSchema);
module.exports.JOB_TYPES = JOB_TYPES;

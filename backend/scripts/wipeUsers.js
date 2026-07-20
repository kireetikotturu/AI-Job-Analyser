// One-off cleanup script — run manually once after the username/schema
// update. Wipes all existing user accounts and everything scoped to them
// (job datasets, uploaded job rows, resume analyses/history — Stripe
// subscription state lives on the User doc itself so it goes with it).
// Sample/guest data (`isSample: true` / owner: null Job rows) is left
// untouched so guests still see the demo dataset.
//
// Usage: node scripts/wipeUsers.js
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const Job = require("../models/Job");
const JobDataset = require("../models/JobDataset");
const ResumeUpload = require("../models/ResumeUpload");

async function run() {
  await connectDB();

  const [users, jobs, datasets, resumes] = await Promise.all([
    User.countDocuments({}),
    Job.countDocuments({ owner: { $ne: null } }),
    JobDataset.countDocuments({}),
    ResumeUpload.countDocuments({}),
  ]);
  console.log(
    `Found ${users} users, ${jobs} owned job rows, ${datasets} job datasets, ${resumes} resume uploads.`
  );

  await Promise.all([
    User.deleteMany({}),
    Job.deleteMany({ owner: { $ne: null } }), // keeps isSample/guest rows
    JobDataset.deleteMany({}),
    ResumeUpload.deleteMany({}),
  ]);

  console.log("✅ Wiped all users and their owned data. Sample/guest jobs were left in place.");
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});

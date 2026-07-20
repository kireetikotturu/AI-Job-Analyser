/**
 * One-time migration: recompute `jobType` for every job already in the DB
 * using the current classifyJobType() rules (Python categories etc).
 * jobType is computed once at upload time and stored, so jobs uploaded
 * before this fix are stuck with their old (often wrong) classification
 * until this script is run.
 *
 * Usage (from backend/ folder):
 *   node scripts/reclassifyJobs.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Job = require("../models/Job");
const { classifyJobType } = require("../utils/parseExcel");

async function run() {
  await connectDB();

  const jobs = await Job.find({});
  console.log(`Found ${jobs.length} jobs. Reclassifying...`);

  let changed = 0;
  const bulkOps = [];

  for (const job of jobs) {
    const newType = classifyJobType(job.jobTitle, job.skills || [], job.description || "");
    if (newType !== job.jobType) {
      changed++;
      bulkOps.push({
        updateOne: {
          filter: { _id: job._id },
          update: { $set: { jobType: newType } },
        },
      });
    }
  }

  if (bulkOps.length > 0) {
    await Job.bulkWrite(bulkOps);
  }

  console.log(`Done. ${changed} of ${jobs.length} jobs were reclassified.`);
  await mongoose.connection.close();
}

run().catch((err) => {
  console.error("Reclassification failed:", err);
  process.exit(1);
});

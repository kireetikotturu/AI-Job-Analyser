const path = require("path");
const fs = require("fs");
const ResumeUpload = require("../models/ResumeUpload");
const JobDataset = require("../models/JobDataset");
const Job = require("../models/Job");
const { reactivateJobDataset } = require("../utils/parseExcel");
const { shapeForPlan } = require("./resumeController");
const { planSnapshot, BASIC_CAP } = require("../utils/matchPlan");

// Lightweight list for the History tab / "Upload from History" picker —
// deliberately excludes extractedText and full recommendedJobs to keep the
// payload small; the picker just needs enough to identify each past upload.
const listHistory = async (req, res) => {
  try {
    const uploads = await ResumeUpload.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("fileName originalFileName overallAtsScore createdAt recommendedJobs storedFileName")
      .lean();

    const data = uploads.map((u) => ({
      id: u._id,
      fileName: u.originalFileName || u.fileName,
      overallAtsScore: u.overallAtsScore,
      jobsMatched: u.recommendedJobs?.length || 0,
      createdAt: u.createdAt,
      downloadable: Boolean(u.storedFileName),
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Returns the full, already-computed analysis result — same shape the
// resume analyzer returns — so "Upload from History" can load it instantly
// without re-running AI analysis. Still Pro-gates suggestedImprovements the
// same way the live endpoints do, since plan status can change after a
// resume was originally analyzed (e.g. downgrade).
const getHistoryItem = async (req, res) => {
  try {
    const doc = await ResumeUpload.findOne({ _id: req.params.id, user: req.user._id });
    if (!doc) return res.status(404).json({ success: false, message: "History item not found." });

    const isPro = req.user.isPro();
    const remainingToday = Math.max(0, BASIC_CAP - req.user.getDailyMatchesUsed());
    res.json({
      success: true,
      data: shapeForPlan(doc, isPro),
      progress: planSnapshot(isPro, doc.matchesUnlocked || 0, isPro ? null : remainingToday),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const downloadHistoryFile = async (req, res) => {
  try {
    const doc = await ResumeUpload.findOne({ _id: req.params.id, user: req.user._id });
    if (!doc || !doc.storedFileName) {
      return res.status(404).json({ success: false, message: "File not available for download." });
    }
    const filePath = path.join(__dirname, "..", "uploads", doc.storedFileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "File no longer exists on the server." });
    }
    res.download(filePath, doc.originalFileName || doc.fileName);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Deletes a past resume analysis: removes the DB record and, if still
// present, the original uploaded file from disk. Purely a history-tidying
// action — doesn't affect the user's job dataset or any other analyses.
const deleteHistoryItem = async (req, res) => {
  try {
    const doc = await ResumeUpload.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!doc) return res.status(404).json({ success: false, message: "History item not found." });

    if (doc.storedFileName) {
      const filePath = path.join(__dirname, "..", "uploads", doc.storedFileName);
      fs.unlink(filePath, () => {}); // best-effort — fine if already gone
    }

    res.json({ success: true, message: "Deleted." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  listHistory,
  getHistoryItem,
  downloadHistoryFile,
  deleteHistoryItem,
  listJobDatasets,
  reactivateJobDatasetById,
  deleteJobDataset,
};

// --- Job dataset (Excel/CSV) history -------------------------------------

// Lists past Excel/CSV uploads for this user — used by "Upload From
// History" on the Job Upload page, and the History tab.
async function listJobDatasets(req, res) {
  try {
    const datasets = await JobDataset.find({ owner: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Which dataset is currently populating this user's live Job rows —
    // shown as "Active" in the picker.
    const activeJob = await Job.findOne({ owner: req.user._id }).select("dataset").lean();
    const activeDatasetId = activeJob?.dataset ? String(activeJob.dataset) : null;

    const data = datasets.map((d) => ({
      id: d._id,
      fileName: d.fileName,
      stats: d.stats,
      createdAt: d.createdAt,
      active: activeDatasetId === String(d._id),
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// Re-activates a previously uploaded Excel/CSV dataset: re-parses the file
// still sitting on disk and swaps it in as the user's current Job rows —
// no re-upload required.
async function reactivateJobDatasetById(req, res) {
  try {
    const dataset = await JobDataset.findOne({ _id: req.params.id, owner: req.user._id });
    if (!dataset || !dataset.storedFileName) {
      return res.status(404).json({ success: false, message: "Dataset not found." });
    }
    const filePath = path.join(__dirname, "..", "uploads", dataset.storedFileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "The original file is no longer available." });
    }
    const stats = await reactivateJobDataset(filePath, req.user._id, dataset._id);
    res.json({ success: true, message: "Dataset reactivated.", stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// Deletes a past job dataset upload from history. If it's the dataset
// currently populating the user's live Job rows, those rows are cleared
// too (rather than leaving "active" Job docs pointing at a deleted
// JobDataset record) — the user simply has no active dataset afterward,
// same as before their first upload.
async function deleteJobDataset(req, res) {
  try {
    const dataset = await JobDataset.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!dataset) return res.status(404).json({ success: false, message: "Dataset not found." });

    if (dataset.storedFileName) {
      const filePath = path.join(__dirname, "..", "uploads", dataset.storedFileName);
      fs.unlink(filePath, () => {});
    }

    await Job.deleteMany({ owner: req.user._id, dataset: dataset._id });

    res.json({ success: true, message: "Deleted." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

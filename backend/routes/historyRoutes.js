const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  listHistory,
  getHistoryItem,
  downloadHistoryFile,
  deleteHistoryItem,
  listJobDatasets,
  reactivateJobDatasetById,
  deleteJobDataset,
} = require("../controllers/historyController");

router.get("/history", protect, listHistory);
router.get("/history/:id", protect, getHistoryItem);
router.get("/history/:id/download", protect, downloadHistoryFile);
router.delete("/history/:id", protect, deleteHistoryItem);

router.get("/history/job-datasets/list", protect, listJobDatasets);
router.post("/history/job-datasets/:id/activate", protect, reactivateJobDatasetById);
router.delete("/history/job-datasets/:id", protect, deleteJobDataset);

module.exports = router;

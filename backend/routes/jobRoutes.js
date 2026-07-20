const express = require("express");
const router = express.Router();
const {
  getJobs,
  filterJobs,
  searchJobs,
  getJobById,
  getFilterOptions,
} = require("../controllers/jobController");
const { optionalAuth } = require("../middleware/auth");

router.get("/jobs/filter-options", optionalAuth, getFilterOptions);
router.get("/jobs/filter", optionalAuth, filterJobs);
router.get("/jobs/search", optionalAuth, searchJobs);
router.get("/jobs/:id", optionalAuth, getJobById);
router.get("/jobs", optionalAuth, getJobs);
router.get("/job/:id", optionalAuth, getJobById);

module.exports = router;

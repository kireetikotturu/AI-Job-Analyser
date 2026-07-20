const express = require("express");
const router = express.Router();
const { uploadExcel } = require("../middleware/upload");
const { uploadExcelController } = require("../controllers/uploadController");
const { protect } = require("../middleware/auth");

// Job data is always private per the uploading account — guests are never
// allowed to upload (they get redirected to /login by the frontend, and
// this is the server-side backstop for that rule).
router.post("/upload-excel", protect, uploadExcel.single("file"), uploadExcelController);

module.exports = router;

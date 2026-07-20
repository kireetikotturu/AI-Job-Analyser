const fs = require("fs");
const crypto = require("crypto");
const { parseAndStoreExcel } = require("../utils/parseExcel");
const JobDataset = require("../models/JobDataset");

function hashFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

// Requires a signed-in user (see uploadRoutes) — job data is always
// private to the uploading account. Replaces only that user's own Job
// rows; the public sample/demo dataset and every other user's data are
// never touched.
const uploadExcelController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const fileHash = hashFile(req.file.path);

    // Duplicate Prevention: if this exact file was already uploaded by
    // this user before, reuse the existing JobDataset record instead of
    // creating a new one — the upload becomes a harmless no-op refresh
    // (job rows are already this dataset's rows) rather than an error.
    const existingDataset = await JobDataset.findOne({ owner: req.user._id, fileHash });
    if (existingDataset) {
      fs.unlink(req.file.path, () => {});
      return res.status(200).json({
        success: true,
        message: "This file was already uploaded — using your existing dataset.",
        stats: { ...existingDataset.stats, duplicateUpload: true },
      });
    }

    const dataset = await JobDataset.create({
      owner: req.user._id,
      fileName: req.file.originalname,
      storedFileName: req.file.filename,
      fileHash,
      stats: {},
    });

    let stats;
    try {
      stats = await parseAndStoreExcel(req.file.path, req.user._id, dataset._id);
    } catch (err) {
      // Parsing failed — remove the placeholder dataset record so it
      // doesn't linger with no matching Job rows behind it.
      await JobDataset.deleteOne({ _id: dataset._id });
      throw err;
    }

    dataset.stats = {
      total: stats.total,
      inserted: stats.inserted,
      duplicates: stats.duplicates,
      errors: stats.errors,
      unmappedColumns: stats.unmappedColumns,
    };
    await dataset.save();

    return res.status(200).json({
      success: true,
      message: "File processed successfully",
      stats,
    });
  } catch (error) {
    console.error("Upload error:", error);
    const isFormatError = error.code === "FORMAT_MISMATCH" || error.code === "EMPTY_FILE";
    return res.status(isFormatError ? 400 : 500).json({
      success: false,
      message: error.message,
      code: error.code || null,
    });
  }
};

module.exports = { uploadExcelController };

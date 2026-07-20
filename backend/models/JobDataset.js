const mongoose = require("mongoose");

// One record per Excel/CSV job dataset a signed-in user has uploaded.
// Lets History show past uploads, prevent duplicate storage of the exact
// same file (`fileHash`), and "Upload From History" re-activate a past
// dataset (re-point the user's active Job rows at it) without asking the
// user to upload the file again.
const JobDatasetSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fileName: { type: String, required: true },
    storedFileName: { type: String, default: null }, // name on disk in /uploads
    fileHash: { type: String, required: true, index: true }, // sha256 of the raw file bytes
    stats: {
      total: Number,
      inserted: Number,
      duplicates: Number,
      errors: Number,
      unmappedColumns: [String],
    },
    isActive: { type: Boolean, default: true }, // whether this dataset is the one currently populating Job rows
  },
  { timestamps: true }
);

JobDatasetSchema.index({ owner: 1, fileHash: 1 }, { unique: true });

module.exports = mongoose.model("JobDataset", JobDatasetSchema);

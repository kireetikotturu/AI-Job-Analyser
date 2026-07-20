const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "uploads"));
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const excelFileFilter = (req, file, cb) => {
  const allowed = [".xlsx", ".xls", ".csv"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error("Only Excel (.xlsx, .xls) or CSV files are allowed"));
};

const resumeFileFilter = (req, file, cb) => {
  const allowed = [".pdf", ".docx"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error("Only PDF or DOCX files are allowed"));
};

const uploadExcel = multer({
  storage,
  fileFilter: excelFileFilter,
  limits: { fileSize: 15 * 1024 * 1024 },
});

const uploadResume = multer({
  storage,
  fileFilter: resumeFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = { uploadExcel, uploadResume };

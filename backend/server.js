require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const { seedSampleJobs } = require("./utils/parseExcel");

const uploadRoutes = require("./routes/uploadRoutes");
const jobRoutes = require("./routes/jobRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const resumeRoutes = require("./routes/resumeRoutes");
const authRoutes = require("./routes/authRoutes");
const historyRoutes = require("./routes/historyRoutes");
const billingRoutes = require("./routes/billingRoutes");
const { handleWebhook } = require("./controllers/billingController");

const app = express();

async function bootstrap() {
  await connectDB();

  // Seeds the public guest/demo dataset (shown to logged-out visitors on
  // Dashboard/All Jobs) from sample-data/sample-jobs.csv exactly once — a
  // no-op on every restart after that first successful seed.
  try {
    const result = await seedSampleJobs(path.join(__dirname, "..", "sample-data", "sample-jobs.csv"));
    if (result.seeded) console.log(`Seeded ${result.count} sample jobs for guest view.`);
  } catch (err) {
    console.error("Sample data seed failed:", err.message);
  }
}

bootstrap();

// =======================
// CORS Configuration
// =======================
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without origin (Postman, mobile apps, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      // Allow localhost during development
      if (/^http:\/\/localhost:\d+$/.test(origin)) {
        return callback(null, true);
      }

      // Allow all Vercel deployments
      if (origin.endsWith(".vercel.app")) {
        return callback(null, true);
      }

      console.log("Blocked CORS Origin:", origin);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

// Stripe webhook needs the exact raw request body to verify the signature,
// so it's mounted BEFORE express.json() and given its own raw parser —
// once express.json() has consumed/parsed the body, signature verification
// would fail.
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), handleWebhook);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Root Route
app.get("/", (req, res) => {
  res.json({
    message: "AI Powered Job Market Analyzer API is running 🚀",
  });
});

// API Routes
app.use("/api", uploadRoutes);
app.use("/api", jobRoutes);
app.use("/api", dashboardRoutes);
app.use("/api", resumeRoutes);
app.use("/api", authRoutes);
app.use("/api", historyRoutes);
app.use("/api", billingRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Server Error",
  });
});

// Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
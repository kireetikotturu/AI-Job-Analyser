import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { UploadCloud, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Loader2, LogIn } from "lucide-react";
import api from "../api/axios";
import { useResumeAnalysis } from "../context/ResumeAnalysisContext";
import { useAuth } from "../context/AuthContext";
import JobHistoryPicker from "./JobHistoryPicker";

export default function UploadDropzone({ onIssue }) {
  const { clearAnalysis } = useResumeAnalysis();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  // Uploading a job dataset is a private, per-account action — guests are
  // sent to /login instead of hitting the (now auth-gated) upload endpoint.
  const requireAuth = () => {
    if (user) return true;
    navigate("/login", { state: { from: "/" } });
    return false;
  };

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (!requireAuth()) return;
    const allowed = [".xlsx", ".xls", ".csv"];
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!allowed.includes(ext)) {
      setError("Please upload a valid Excel (.xlsx, .xls) or CSV file.");
      onIssue?.();
      return;
    }

    setError(null);
    setStats(null);
    setFileName(file.name);
    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/upload-excel", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => {
          const percent = Math.round((evt.loaded * 100) / evt.total);
          setProgress(percent);
        },
      });
      setStats(res.data.stats);
      // A fresh dataset just replaced whatever was in the DB — any resume
      // analysis cached from before (in memory or sessionStorage) is now
      // scored against jobs that no longer exist, so it must not resurface
      // on the Resume Analyzer page.
      clearAnalysis();
      if (res.data.stats?.errors > 0 || res.data.stats?.unmappedColumns?.length > 0) {
        onIssue?.();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Upload failed. Please try again.");
      onIssue?.();
    } finally {
      setUploading(false);
    }
  }, [user]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (!requireAuth()) return;
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  const onDropzoneClick = () => {
    if (!requireAuth()) return;
    inputRef.current?.click();
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <motion.div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={onDropzoneClick}
        animate={{
          borderColor: dragActive ? "#6D5BF0" : "rgba(22,22,22,0.15)",
          scale: dragActive ? 1.01 : 1,
        }}
        className="glass-card cursor-pointer border-2 border-dashed rounded-xl3 p-12 flex flex-col items-center justify-center text-center shadow-soft transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <div className="w-16 h-16 rounded-full bg-purple-gradient flex items-center justify-center mb-4 shadow-glow">
          {uploading ? (
            <Loader2 className="text-white animate-spin" size={26} />
          ) : !user ? (
            <LogIn className="text-white" size={24} />
          ) : (
            <UploadCloud className="text-white" size={26} />
          )}
        </div>
        <p className="font-display text-lg font-semibold">
          {!user ? "Sign in to upload your job dataset" : fileName ? fileName : "Drag & drop your dataset here"}
        </p>
        <p className="text-sm text-ink/50 mt-1">
          {!user ? "Your data stays private to your account" : "Excel (.xlsx, .xls) or CSV — up to 15MB"}
        </p>
        <span className="mt-4 pill">
          {!user ? <LogIn size={13} /> : <FileSpreadsheet size={13} />}
          {!user ? "Log in to get started" : "or click to browse"}
        </span>
      </motion.div>

      {user && (
        <div className="mt-4 flex items-center justify-center">
          <JobHistoryPicker
            onActivated={(nextStats) => {
              setStats(nextStats);
              clearAnalysis();
            }}
          />
        </div>
      )}
      <AnimatePresence>
        {uploading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4"
          >
            <div className="w-full h-2.5 bg-black/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-purple-gradient"
                animate={{ width: `${progress}%` }}
                transition={{ ease: "easeOut" }}
              />
            </div>
            <p className="text-xs text-ink/50 mt-1.5 text-right">{progress}%</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl2 px-4 py-3 text-sm"
          >
            <XCircle size={16} /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3"
          >
            <StatBox label="Total Records" value={stats.total} icon={FileSpreadsheet} tint="purple" />
            <StatBox label="Inserted" value={stats.inserted} icon={CheckCircle2} tint="green" />
            <StatBox label="Old Records Cleared" value={stats.replaced ?? 0} icon={CheckCircle2} tint="blue" />
            <StatBox label="Duplicates" value={stats.duplicates} icon={AlertTriangle} tint="orange" />
            <StatBox label="Errors" value={stats.errors} icon={XCircle} tint="red" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stats?.unmappedColumns?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl2 px-4 py-3 text-xs"
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              These columns weren't recognized and were ignored: {stats.unmappedColumns.join(", ")}. Everything
              else was mapped and stored correctly.
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatBox({ label, value, icon: Icon, tint }) {
  const colors = {
    purple: "bg-accent-purple/10 text-accent-purple",
    green: "bg-emerald-100 text-emerald-600",
    blue: "bg-sky-100 text-sky-600",
    orange: "bg-orange-100 text-orange-600",
    red: "bg-red-100 text-red-600",
  };
  return (
    <div className="glass-card rounded-xl2 p-4 text-center shadow-soft">
      <div className={`w-9 h-9 mx-auto rounded-full flex items-center justify-center mb-2 ${colors[tint]}`}>
        <Icon size={16} />
      </div>
      <p className="text-xl font-bold font-display">{value}</p>
      <p className="text-[11px] text-ink/50 font-medium">{label}</p>
    </div>
  );
}

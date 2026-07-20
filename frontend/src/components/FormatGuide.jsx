import { motion, AnimatePresence } from "framer-motion";
import { Download, Info, ChevronDown } from "lucide-react";

const RECOMMENDED_COLUMNS = [
  { field: "Job Title", synonyms: "Job Role, Position, Designation" },
  { field: "Company", synonyms: "Company Name, Employer, Organization" },
  { field: "Location", synonyms: "City, Job Location" },
  { field: "Salary", synonyms: "CTC, Package, Compensation (e.g. \"2.8-8.7 LPA\", \"50k-80k\", \"6,00,000\")" },
  { field: "Experience", synonyms: "Exp, Years of Experience" },
  { field: "Skills", synonyms: "Skill Set, Tech Stack (comma or | separated)" },
  { field: "Description", synonyms: "Job Description, JD, Summary" },
  { field: "Employment Type", synonyms: "Type, Work Type (Full-time, Remote, ...)" },
  { field: "Industry", synonyms: "Sector, Domain" },
  { field: "Education", synonyms: "Qualification, Eligibility (e.g. \"B.E, B.Tech, BCA, MCA\")" },
  { field: "Apply Link", synonyms: "Apply URL, Job URL" },
  { field: "Posted Date", synonyms: "Date, Posting Date" },
  { field: "Source", synonyms: "Portal, Platform" },
];

const SAMPLE_ROWS = [
  {
    "Job Title": "MERN Stack Developer",
    Company: "Bright Softworks",
    Location: "Hyderabad",
    Salary: "4.5-8.2 LPA",
    Experience: "2-4 years",
    Skills: "React, Node.js, MongoDB, Express",
    Description: "Build and maintain full-stack web applications.",
    "Employment Type": "Full-time",
    Industry: "IT Services",
    Education: "B.E, B.Tech, BCA, MCA",
    "Apply Link": "https://example.com/apply/1",
    "Posted Date": "2026-07-01",
    Source: "Naukri",
  },
  {
    "Job Title": "AI Engineer",
    Company: "NeuralWorks",
    Location: "Bengaluru",
    Salary: "8-15 LPA",
    Experience: "3-5 years",
    Skills: "Python, PyTorch, LLM, LangChain",
    Description: "Design and ship LLM-powered product features.",
    "Employment Type": "Full-time",
    Industry: "Artificial Intelligence",
    Education: "B.Tech, M.Tech, MCA",
    "Apply Link": "https://example.com/apply/2",
    "Posted Date": "2026-07-03",
    Source: "LinkedIn",
  },
];

function downloadSampleCSV() {
  const headers = Object.keys(SAMPLE_ROWS[0]);
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    headers.join(","),
    ...SAMPLE_ROWS.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "job-analyzer-sample-template.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Controlled accordion: the parent (UploadPage) owns `open` so it can force
// this panel open the moment an upload comes back with validation issues,
// while still letting the user toggle it manually via the header button
// the rest of the time.
export default function FormatGuide({ open, onToggle, flagged }) {
  return (
    <div className="w-full max-w-2xl mx-auto mt-6 text-left">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center justify-between gap-3 rounded-xl2 px-4 py-3 text-sm font-semibold transition-colors ${
          flagged
            ? "bg-amber-50 text-amber-800 border border-amber-200"
            : "glass-card text-ink/75 border border-black/5 hover:bg-black/5"
        }`}
      >
        <span className="flex items-center gap-2">
          <Info size={15} className={flagged ? "text-amber-600" : "text-accent-purple"} />
          {flagged ? "Check your file format — some columns weren't recognized" : "Upload format & instructions"}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="guide-body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="glass-card rounded-xl3 p-6 shadow-soft mt-2">
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink/80">
                  <Info size={15} className="text-accent-purple" /> Expected file format
                </div>
                <button
                  onClick={downloadSampleCSV}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3.5 py-2 bg-black/5 hover:bg-black/10 transition-colors"
                >
                  <Download size={13} /> Download sample template
                </button>
              </div>

              <p className="text-xs text-ink/55 mb-4">
                Column names are flexible — we auto-match common variations, so your sheet doesn't need to use these
                exact headers. Here's the recommended layout; every field maps automatically and falls back to a
                sensible default if a column is missing.
              </p>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-purple mb-2">
                  Recommended Excel Format
                </p>
                <div className="rounded-xl2 border border-black/10 overflow-hidden">
                  {RECOMMENDED_COLUMNS.map((c, i) => (
                    <div
                      key={c.field}
                      className={`flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3 px-3 py-2 text-xs ${
                        i % 2 === 0 ? "bg-black/[0.02]" : ""
                      }`}
                    >
                      <span className="font-semibold text-ink/80 shrink-0 sm:w-32">{c.field}</span>
                      <span className="text-ink/45">accepts: {c.synonyms}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-ink/40 mt-4 pt-3 border-t border-black/5">
                Heads up: uploading a new file replaces your current job dataset. Uploading the exact same file
                again is detected automatically and won't be re-processed.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

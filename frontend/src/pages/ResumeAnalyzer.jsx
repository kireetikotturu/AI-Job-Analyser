import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  FileText,
  Loader2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Search,
  SlidersHorizontal,
  Eye,
  Lock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getApplyHref } from "../utils/applyLink";
import { useResumeAnalysis } from "../context/ResumeAnalysisContext";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import Modal from "../components/Modal";
import UsageBar from "../components/UsageBar";
import HistoryPicker from "../components/HistoryPicker";

function scoreColor(score) {
  if (score >= 90)
    return {
      bg: "bg-emerald-100",
      text: "text-emerald-700",
      ring: "ring-emerald-300",
    };
  if (score >= 70)
    return { bg: "bg-blue-100", text: "text-blue-700", ring: "ring-blue-300" };
  if (score >= 50)
    return {
      bg: "bg-orange-100",
      text: "text-orange-700",
      ring: "ring-orange-300",
    };
  return { bg: "bg-red-100", text: "text-red-700", ring: "ring-red-300" };
}

// "Show top N" options for browsing the already-unlocked matches. Only
// values smaller than the actual unlocked count are offered (no point
// showing "Top 100" when only 40 are unlocked) — "All" always covers the
// rest. This is a purely client-side view filter, separate from the
// backend "Unlock more matches" call — it never triggers a new AI request.
const TOPN_OPTIONS = [5, 10, 20, 40, 60, 80, 100];
const PAGE_SIZE = 10;

export default function ResumeAnalyzer() {
  // All analysis state lives in ResumeAnalysisContext (mounted once at the
  // App root), not in this component. That's what makes the analysis keep
  // running — and its result still land — even if you switch to Dashboard
  // or All Jobs while it's in progress. This component just renders it.
  const {
    fileName,
    loading,
    unlocking,
    result,
    error: analysisError,
    progress,
    analyzeResume,
    unlockMore,
    loadFromHistory,
  } = useResumeAnalysis();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dragActive, setDragActive] = useState(false);
  const [fileTypeError, setFileTypeError] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const inputRef = useRef(null);
  // analysisError from context is now { message, code } | null.
  const error = fileTypeError ? { message: fileTypeError } : analysisError;

  // Sends the user straight to Stripe Checkout instead of just to /account —
  // "Upgrade to Pro" should mean "start paying now", not "go look at a page".
  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    try {
      const res = await api.post("/billing/create-checkout-session");
      window.location.href = res.data.data.url;
    } catch {
      setCheckoutLoading(false);
    }
  };

  // Arriving from Account → "View" on a past resume: load that saved
  // analysis straight in, no re-upload or AI call needed.
  const location = useLocation();
  useEffect(() => {
    const historyId = location.state?.historyId;
    if (!historyId) return;
    api
      .get(`/history/${historyId}`)
      .then((res) => loadFromHistory(res.data))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.historyId]);

  // Search/filter/sort applied to the already-fetched recommendedJobs list —
  // this is purely client-side (no new API calls), since the full result
  // set for this analysis is already sitting in the context/sessionStorage.
  const [jobSearch, setJobSearch] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("");
  const [minMatch, setMinMatch] = useState(0);
  const [sortBy, setSortBy] = useState("matchDesc");
  // "all" = show every unlocked match; otherwise a number from TOPN_OPTIONS.
  const [topN, setTopN] = useState("all");
  const [page, setPage] = useState(1);

  // "View Details" opens the same Modal used on the All Jobs page. The
  // recommendedJobs entries only carry a slim set of fields (title, company,
  // scores, skills, applyLink) — not location/salary/description — so we
  // fetch the full job document by id (GET /jobs/:id) on demand instead of
  // bloating every resume-analysis response with data most cards never show.
  const [selectedJob, setSelectedJob] = useState(null);
  const [viewLoadingId, setViewLoadingId] = useState(null);

  const jobTypeOptions = useMemo(() => {
    const types = new Set(
      (result?.recommendedJobs || []).map((j) => j.jobType).filter(Boolean),
    );
    return [...types].sort();
  }, [result]);

  // Only offer "Top N" tiers smaller than what's actually unlocked right
  // now — e.g. if only 20 matches are unlocked, there's no point showing
  // "Top 40"/"Top 60" etc, since those would be identical to "All".
  const topNOptions = useMemo(() => {
    const total = result?.recommendedJobs?.length || 0;
    return TOPN_OPTIONS.filter((n) => n < total);
  }, [result]);

  const filteredJobs = useMemo(() => {
    const allJobs = result?.recommendedJobs || [];
    // Apply the "Top N" view filter FIRST, against the original rank order
    // (recommendedJobs already comes sorted best-match-first from the
    // backend) — so "Top 20" always means the 20 best matches, regardless
    // of how the list is re-sorted for display afterwards.
    const jobs = topN === "all" ? allJobs : allJobs.slice(0, Number(topN));
    const q = jobSearch.trim().toLowerCase();

    const filtered = jobs.filter((job) => {
      if (minMatch && (job.matchPercent ?? 0) < minMatch) return false;
      if (jobTypeFilter && job.jobType !== jobTypeFilter) return false;
      if (q) {
        const haystack = [
          job.jobTitle,
          job.company,
          ...(job.matchedSkills || []),
          ...(job.missingSkills || []),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...filtered];
    switch (sortBy) {
      case "atsDesc":
        sorted.sort((a, b) => (b.atsScore ?? 0) - (a.atsScore ?? 0));
        break;
      case "titleAsc":
        sorted.sort((a, b) =>
          (a.jobTitle || "").localeCompare(b.jobTitle || ""),
        );
        break;
      case "matchDesc":
      default:
        sorted.sort((a, b) => (b.matchPercent ?? 0) - (a.matchPercent ?? 0));
    }
    return sorted;
  }, [result, jobSearch, jobTypeFilter, minMatch, sortBy, topN]);

  // Reset to page 1 whenever any filter (or the result itself) changes —
  // otherwise you could land on, say, page 4 with only 2 pages of results
  // after narrowing a filter.
  useEffect(() => {
    setPage(1);
  }, [jobSearch, jobTypeFilter, minMatch, sortBy, topN, result]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const pagedJobs = useMemo(
    () => filteredJobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredJobs, page],
  );

  const clearJobFilters = () => {
    setJobSearch("");
    setJobTypeFilter("");
    setMinMatch(0);
    setSortBy("matchDesc");
    setTopN("all");
  };

  const handleFile = (file) => {
    if (!user) {
      navigate("/login", { state: { from: "/resume-analyzer" } });
      return;
    }
    if (!file) return;
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (![".pdf", ".docx"].includes(ext)) {
      setFileTypeError("Please upload a PDF or DOCX resume.");
      return;
    }
    setFileTypeError(null);
    analyzeResume(file);
  };

  // Sends the right kind of number for the active plan: an absolute total
  // for Pro (dropdown always lists 20/40/60/80/100), or an additive +N for
  // Basic (dropdown only ever offers what's left up to the 20 cap).
  const handleUnlockMore = (value) => {
    if (!value) return;
    unlockMore(Number(value));
  };

  const handleViewDetails = async (job) => {
    if (!job.job) return;
    setViewLoadingId(job.job);
    try {
      const res = await api.get(`/jobs/${job.job}`);
      setSelectedJob(res.data.data);
    } catch (e) {
      // Fallback: the job may have been removed from the dataset since this
      // resume was analyzed. Show whatever we already have client-side
      // instead of leaving the button stuck or throwing an error.
      setSelectedJob({
        jobTitle: job.jobTitle,
        company: job.company,
        applyLink: job.applyLink,
        skills: [...(job.matchedSkills || []), ...(job.missingSkills || [])],
      });
    } finally {
      setViewLoadingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <p className="text-xs font-semibold tracking-widest uppercase text-accent-orange mb-2">
          AI Resume Analyzer
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold mb-3">
          See exactly how your resume stacks up
        </h1>
        <p className="text-ink/55 max-w-lg mx-auto text-sm">
          Upload your resume — we'll score it against every job in the database
          and surface your best matches.
        </p>
      </motion.div>

      <motion.div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        animate={{
          borderColor: dragActive ? "#6D5BF0" : "rgba(22,22,22,0.15)",
        }}
        className="glass-card cursor-pointer border-2 border-dashed rounded-xl3 p-10 flex flex-col items-center justify-center text-center shadow-soft max-w-xl mx-auto mb-10"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <div className="w-14 h-14 rounded-full bg-purple-gradient flex items-center justify-center mb-3 shadow-glow">
          {loading ? (
            <Loader2 className="text-white animate-spin" size={22} />
          ) : (
            <UploadCloud className="text-white" size={22} />
          )}
        </div>
        <p className="font-display font-semibold">
          {!user ? "Sign in to analyze your resume" : fileName || "Upload your resume"}
        </p>
        <p className="text-xs text-ink/50 mt-1">
          {!user ? "Your resume and results stay private to your account" : "PDF or DOCX, up to 10MB"}
        </p>
        {loading && (
          <p className="text-xs text-accent-purple font-semibold mt-3">
            Analyzing with AI...
          </p>
        )}
      </motion.div>

      {/* Guests get a short pointer to the two things they need to do
          (sign in, then bring their own job data) instead of any leftover
          analysis from a previous account in this browser tab. */}
      {!user && (
        <p className="text-center text-xs text-ink/45 max-w-md mx-auto -mt-6 mb-10">
          Sign in, then upload an Excel/CSV job dataset to build your own dashboard —
          and upload your resume here to get matched against it.
        </p>
      )}

      <UsageBar progress={progress} />

      {/* Only ever visible for signed-in users who actually have past
          uploads — HistoryPicker returns null otherwise. */}
      <div className="flex items-center justify-center mb-10">
        <HistoryPicker onSelect={loadFromHistory} />
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`max-w-xl mx-auto flex flex-col sm:flex-row items-center gap-3 rounded-xl2 px-4 py-3 text-sm mb-8 ${
              error.code === "NO_JOB_DATA"
                ? "text-amber-800 bg-amber-50 border border-amber-200"
                : "text-red-600 bg-red-50 border border-red-200"
            }`}
          >
            <span className="flex items-center gap-2">
              <XCircle size={16} className="shrink-0" /> {error.message}
            </span>
            {error.code === "NO_JOB_DATA" && (
              <button
                onClick={() => navigate("/")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3.5 py-1.5 bg-ink text-white hover:opacity-90 transition-opacity shrink-0 sm:ml-auto"
              >
                <UploadCloud size={13} /> Upload Job Data
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="glass-card rounded-xl3 p-6 shadow-card mb-8 flex flex-col sm:flex-row items-center gap-6">
              <div
                className={`w-24 h-24 rounded-full flex flex-col items-center justify-center ring-4 ${
                  scoreColor(result.overallAtsScore).ring
                } ${scoreColor(result.overallAtsScore).bg}`}
              >
                <span
                  className={`text-2xl font-bold font-display ${scoreColor(result.overallAtsScore).text}`}
                >
                  {result.overallAtsScore}
                </span>
                <span className="text-[10px] font-semibold text-ink/40">
                  ATS SCORE
                </span>
              </div>
              <div className="flex-1 w-full">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="font-display font-semibold text-lg">
                    Suggested Improvements
                  </h3>
                  {result.suggestedImprovementsLocked && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-accent-purple/10 text-accent-purple shrink-0">
                      <Lock size={10} /> PRO
                    </span>
                  )}
                </div>
                {result.suggestedImprovementsLocked ? (
                  <div className="rounded-xl2 border border-dashed border-accent-purple/30 bg-accent-purple/5 px-4 py-4 text-sm text-ink/60 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <span>Unlock AI-written resume improvement tips with Pro.</span>
                    <button
                      onClick={handleUpgrade}
                      disabled={checkoutLoading}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-4 py-2 text-white bg-purple-gradient shadow-glow hover:opacity-90 transition-opacity shrink-0 sm:ml-auto disabled:opacity-60"
                    >
                      {checkoutLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Upgrade to Pro
                    </button>
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {result.suggestedImprovements?.map((s, i) => (
                      <li
                        key={i}
                        className="text-sm text-ink/65 flex items-start gap-2"
                      >
                        <CheckCircle2
                          size={14}
                          className="text-accent-purple mt-0.5 shrink-0"
                        />{" "}
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="font-display font-semibold text-xl">
                Top {result.recommendedJobs?.length || progress?.matchesUnlocked || 0} Recommended Jobs
              </h3>
              <div className="flex items-center gap-3">
                {result.recommendedJobs?.length > 0 && (
                  <span className="text-xs text-ink/45">
                    Showing {filteredJobs.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
                    {"\u2013"}
                    {Math.min(page * PAGE_SIZE, filteredJobs.length)} of{" "}
                    {filteredJobs.length}
                  </span>
                )}
                {progress?.nextOptions?.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <select
                      disabled={unlocking}
                      value=""
                      onChange={(e) => handleUnlockMore(e.target.value)}
                      className="text-xs font-semibold rounded-full px-3 py-1.5 bg-black/5 border border-black/10 focus:outline-none disabled:opacity-50"
                    >
                      <option value="" disabled>
                        {unlocking ? "Unlocking..." : "Unlock more matches"}
                      </option>
                      {progress.nextOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {progress.isPro ? `Show top ${opt}` : `+${opt} more`}
                        </option>
                      ))}
                    </select>
                    {unlocking && <Loader2 size={13} className="animate-spin text-accent-purple" />}
                  </div>
                )}
              </div>
            </div>

            {result.recommendedJobs?.length > 0 && (
              <div className="glass-card rounded-xl3 p-4 shadow-soft mb-6 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30"
                  />
                  <input
                    value={jobSearch}
                    onChange={(e) => setJobSearch(e.target.value)}
                    placeholder="Search title, company, skill..."
                    className="w-full pl-8 pr-3 py-2 rounded-full bg-white/80 border border-black/10 text-xs focus:outline-none focus:ring-2 focus:ring-accent-purple/40"
                  />
                </div>

                {/* "Show top N" — a client-side view filter over the
                    already-unlocked matches. Only offers tiers smaller
                    than the current unlocked count (see topNOptions). */}
                {topNOptions.length > 0 && (
                  <select
                    value={topN}
                    onChange={(e) => setTopN(e.target.value)}
                    className="text-xs font-semibold rounded-full px-3 py-2 bg-black/5 border border-black/10 focus:outline-none"
                  >
                    <option value="all">
                      Show all {result.recommendedJobs.length}
                    </option>
                    {topNOptions.map((n) => (
                      <option key={n} value={n}>
                        Show top {n}
                      </option>
                    ))}
                  </select>
                )}

                {jobTypeOptions.length > 1 && (
                  <select
                    value={jobTypeFilter}
                    onChange={(e) => setJobTypeFilter(e.target.value)}
                    className="text-xs font-semibold rounded-full px-3 py-2 bg-black/5 border border-black/10 focus:outline-none"
                  >
                    <option value="">All categories</option>
                    {jobTypeOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                )}

                <select
                  value={minMatch}
                  onChange={(e) => setMinMatch(Number(e.target.value))}
                  className="text-xs font-semibold rounded-full px-3 py-2 bg-black/5 border border-black/10 focus:outline-none"
                >
                  <option value={0}>Any match %</option>
                  <option value={50}>50%+ match</option>
                  <option value={70}>70%+ match</option>
                  <option value={90}>90%+ match</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="text-xs font-semibold rounded-full px-3 py-2 bg-black/5 border border-black/10 focus:outline-none"
                >
                  <option value="matchDesc">Sort: Best match</option>
                  <option value="atsDesc">Sort: ATS score</option>
                  <option value="titleAsc">Sort: Job title (A-Z)</option>
                </select>

                {(jobSearch ||
                  jobTypeFilter ||
                  minMatch > 0 ||
                  sortBy !== "matchDesc" ||
                  topN !== "all") && (
                  <button
                    onClick={clearJobFilters}
                    className="flex items-center gap-1 text-xs font-semibold rounded-full px-3 py-2 bg-black/5 hover:bg-black/10 transition-colors"
                  >
                    <SlidersHorizontal size={12} /> Clear
                  </button>
                )}
              </div>
            )}

            {result.recommendedJobs?.length > 0 &&
              filteredJobs.length === 0 && (
                <div className="text-center py-16 text-sm text-ink/50">
                  No jobs match your filters — try clearing them.
                </div>
              )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {pagedJobs.map((job, i) => {
                const applyHref = getApplyHref(job.applyLink);
                const isViewLoading = viewLoadingId === job.job;

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    whileHover={{ y: -4 }}
className="rounded-xl3 bg-white/50 backdrop-blur-xl border border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden flex flex-col"                  >
                    {/* Slim identity strip — the one place the brand gradient
                        lives on this card, so it reads as an accent, not a
                        wash that fights with the (solid white) card body. */}

                    <div className="p-5 flex flex-col flex-1">
                      {/* Header: avatar + title/company + match badge */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-11 h-11 shrink-0 rounded-xl2 bg-purple-gradient flex items-center justify-center text-white font-bold font-display">
                            {job.company?.[0]?.toUpperCase() || "J"}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-display font-semibold text-[15px] leading-snug truncate text-ink">
                              {job.jobTitle}
                            </h4>
                            <p className="text-xs text-ink/50 flex items-center gap-1 mt-0.5">
                              <FileText size={11} /> {job.company}
                            </p>
                          </div>
                        </div>

                        <span className="shrink-0 text-[11px] font-bold px-3 py-1 rounded-full text-white bg-accent-purple">
                          {job.matchPercent}% Match
                        </span>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-4">
                        {job.jobType && (
                          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-accent-purple/10 text-accent-purple">
                            {job.jobType}
                          </span>
                        )}
                        <span
                          title="Resume formatting/ATS-parsing quality — based on the resume itself, so it's similar across jobs. Match % is what actually differs per job."
                          className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-black/5 text-ink/50"
                        >
                          ATS {job.atsScore}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-[11px] text-ink/50 mb-1.5">
                          <span className="font-medium">Skill match</span>
                          <span className="font-bold text-accent-purple">
                            {job.matchPercent}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-accent-purple transition-all duration-700 ease-out"
                            style={{
                              width: `${Math.max(4, Math.min(100, job.matchPercent || 0))}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Skill chips */}
                      {(job.matchedSkills?.length > 0 ||
                        job.missingSkills?.length > 0) && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {job.matchedSkills?.slice(0, 2).map((s) => (
                            <span
                              key={`m-${s}`}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
                            >
                              ✓ {s}
                            </span>
                          ))}
                          {job.missingSkills?.slice(0, 2).map((s) => (
                            <span
                              key={`x-${s}`}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200"
                            >
                              Missing: {s}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Actions — centered on one line */}
                      <div className="mt-auto pt-4 flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleViewDetails(job)}
                          disabled={isViewLoading}
                          className="inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold rounded-full px-4 py-2 border border-black/15 text-ink/70 hover:bg-black/5 transition-colors disabled:opacity-50"
                        >
                          {isViewLoading ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Eye size={12} />
                          )}
                          View Details
                        </button>

                        {applyHref ? (
                          <a
                            href={applyHref}
                            target="_blank"
                            rel="noreferrer"
className="inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold rounded-full px-4 py-2 text-white bg-[#f17240] hover:bg-[#D97706] transition-all duration-300 shadow-md hover:shadow-lg"                          >
                            Apply Now <ExternalLink size={11} />
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            title="No apply link available for this job"
                            className="inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold rounded-full px-4 py-2 bg-black/5 text-ink/30 cursor-not-allowed"
                          >
                            No link
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Pagination — only shown once results actually overflow one
                page, so nothing changes visually for small result sets. */}
            {filteredJobs.length > PAGE_SIZE && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="inline-flex items-center gap-1 text-xs font-semibold rounded-full px-3.5 py-2 border border-black/10 text-ink/70 hover:bg-black/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={13} /> Prev
                </button>
                <span className="text-xs font-semibold text-ink/50 px-2">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="inline-flex items-center gap-1 text-xs font-semibold rounded-full px-3.5 py-2 border border-black/10 text-ink/70 hover:bg-black/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight size={13} />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Modal job={selectedJob} onClose={() => setSelectedJob(null)} />
    </div>
  );
}
// Centralized sessionStorage keys shared across pages.
// RESUME_RESULT_KEY holds the last resume analysis so switching tabs and
// coming back doesn't lose your results. It must be cleared whenever a new
// job dataset is uploaded — otherwise the Resume Analyzer page keeps showing
// matches against jobs that no longer exist in the (freshly replaced) DB.
export const RESUME_RESULT_KEY = "resumeAnalyzer:lastResult";

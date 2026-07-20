import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import api from "../api/axios";
import { RESUME_RESULT_KEY } from "../utils/storageKeys";
import { useAuth } from "./AuthContext";

// Set right before an unload that happens *while an analysis is running*.
// Checked once on the next app boot so a refresh mid-analysis lands the
// user back on the Upload page instead of showing a stale/empty
// Resume Analyzer page.
export const RESUME_INTERRUPTED_KEY = "resumeAnalyzer:interrupted";

const ResumeAnalysisContext = createContext(null);

export function ResumeAnalysisProvider({ children }) {
  const { user, initializing, isPro } = useAuth();
  const [fileName, setFileName] = useState(null);
  const [loading, setLoading] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  // Full-plan snapshot from the last analyze/unlock response — drives the
  // progress bar and "unlock more" dropdown. Shape: { isPro, matchesUnlocked,
  // cap, remaining, nextOptions, atCap }.
  const [progress, setProgress] = useState(null);
  const loadingRef = useRef(false);
  // Tracks which account the currently-rendered result belongs to, so a
  // fresh sign-in/sign-up (or logging out to the public page) never shows
  // another account's leftover analysis from earlier in the same tab.
  const lastOwnerIdRef = useRef(undefined);
  // Tracks the Pro status the currently-cached `result`/`progress` was
  // shaped for. Upgrading mid-session (e.g. just back from Stripe
  // Checkout) doesn't touch this cached snapshot on its own — it still
  // shows "Suggested Improvements locked" and the old Basic daily-limit
  // banner until something re-fetches. See the effect below.
  const lastIsProRef = useRef(undefined);

  // Rehydrate the last completed analysis on first load (survives full
  // page refreshes when nothing was in-flight at the time) — but only if
  // it belongs to the currently signed-in user. Waits for the initial
  // /auth/me check so we don't briefly rehydrate before `user` is known.
  useEffect(() => {
    if (initializing) return;
    try {
      const saved = sessionStorage.getItem(RESUME_RESULT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (user && parsed.ownerId === user.id) {
          if (parsed.result) setResult(parsed.result);
          if (parsed.fileName) setFileName(parsed.fileName);
          if (parsed.progress) setProgress(parsed.progress);
        } else {
          // Belongs to a guest session or a different account — drop it.
          sessionStorage.removeItem(RESUME_RESULT_KEY);
        }
      }
    } catch {
      // ignore malformed/missing storage
    }
    lastOwnerIdRef.current = user?.id ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializing]);

  // Whenever the signed-in account changes (login, logout, switching
  // accounts in the same tab), wipe any in-memory/stored analysis that
  // belonged to the previous owner so it never bleeds into the new session.
  useEffect(() => {
    if (initializing) return;
    const currentOwnerId = user?.id ?? null;
    if (lastOwnerIdRef.current === undefined) {
      lastOwnerIdRef.current = currentOwnerId;
      return;
    }
    if (lastOwnerIdRef.current !== currentOwnerId) {
      setResult(null);
      setError(null);
      setFileName(null);
      setProgress(null);
      try {
        sessionStorage.removeItem(RESUME_RESULT_KEY);
      } catch {
        // non-fatal
      }
      lastOwnerIdRef.current = currentOwnerId;
    }
  }, [user, initializing]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  // The actual fix: whenever isPro flips (upgrade OR downgrade) after a
  // result is already cached, re-fetch that same analysis from
  // GET /history/:id — it recomputes suggestedImprovements/locked and the
  // plan progress snapshot fresh from the CURRENT plan, using AI feedback
  // that was already generated and stored (so this costs no new AI call,
  // no re-upload, just an instant unlock/lock refresh).
  useEffect(() => {
    if (initializing) return;
    if (lastIsProRef.current === undefined) {
      lastIsProRef.current = isPro;
      return;
    }
    if (lastIsProRef.current !== isPro && result?.id) {
      api
        .get(`/history/${result.id}`)
        .then((res) => {
          setResult(res.data.data);
          setProgress(res.data.progress);
          persist(res.data.data, fileName, res.data.progress);
        })
        .catch(() => {
          // Non-fatal — worst case the stale snapshot stays until the
          // next analyze/unlock call refreshes it.
        });
    }
    lastIsProRef.current = isPro;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro, initializing]);

  // Warn before the tab closes/refreshes while an analysis is running,
  // since that request cannot be resumed once the page reloads. If the
  // user confirms anyway, flag it so the next app boot knows to send
  // them back to the Upload page instead of leaving them on a stale
  // Resume Analyzer view.
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!loadingRef.current) return;
      try {
        sessionStorage.setItem(RESUME_INTERRUPTED_KEY, "1");
      } catch {
        // non-fatal
      }
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const clearAnalysis = useCallback(() => {
    setResult(null);
    setError(null);
    setFileName(null);
    setProgress(null);
    try {
      sessionStorage.removeItem(RESUME_RESULT_KEY);
    } catch {
      // non-fatal
    }
  }, []);

  const persist = (data, name, prog) => {
    try {
      sessionStorage.setItem(
        RESUME_RESULT_KEY,
        JSON.stringify({ result: data, fileName: name, progress: prog, ownerId: user?.id ?? null })
      );
    } catch {
      // storage full or unavailable — non-fatal, just won't persist
    }
  };

  // POST /resume — requires sign-in (enforced server-side too). Runs the
  // first pass: Basic plan starts at Top 5 / 20 max, Pro starts at Top 20.
  // No `limit` is sent — the initial total is decided by the user's plan.
  const analyzeResume = useCallback(async (file) => {
    if (!file) return;
    setError(null);
    setResult(null);
    setProgress(null);
    setFileName(file.name);
    setLoading(true);

    const formData = new FormData();
    formData.append("resume", file);

    try {
      // Runs against the shared context, not component state, so it
      // keeps going (and the result still lands) even if the user
      // switches to Dashboard/Jobs/etc. while this is in flight.
      const res = await api.post("/resume", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data.data);
      setProgress(res.data.progress);
      persist(res.data.data, file.name, res.data.progress);
    } catch (err) {
      setError({
        message: err.response?.data?.message || "Analysis failed. Please try again.",
        code: err.response?.data?.code || null,
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // "Unlock more matches" — re-runs AI analysis against the SAME stored
  // resume + current job dataset, no re-upload needed. `requested` is an
  // additive +N for Basic plans, or an absolute total for Pro plans (see
  // backend/utils/matchPlan.js — the dropdown built in ResumeAnalyzer
  // already sends the right kind of number for the active plan).
  const unlockMore = useCallback(
    async (requested) => {
      if (!result?.id) return;
      setError(null);
      setUnlocking(true);
      try {
        const res = await api.post(`/resume/${result.id}/matches`, { requested });
        setResult(res.data.data);
        setProgress(res.data.progress);
        persist(res.data.data, fileName, res.data.progress);
      } catch (err) {
        setError({
          message: err.response?.data?.message || "Couldn't unlock more matches. Please try again.",
          code: err.response?.data?.code || null,
        });
      } finally {
        setUnlocking(false);
      }
    },
    [result, fileName, user?.id]
  );

  // Loads an already-computed analysis (from GET /history/:id) straight into
  // state — no re-upload, no AI call. Used by "Upload from History".
  const loadFromHistory = useCallback((payload) => {
    setError(null);
    setResult(payload.data || payload);
    setProgress(payload.progress || null);
    const name = (payload.data || payload).fileName || null;
    setFileName(name);
    persist(payload.data || payload, name, payload.progress || null);
  }, [user?.id]);

  const value = {
    fileName,
    loading,
    unlocking,
    result,
    error,
    progress,
    analyzeResume,
    unlockMore,
    clearAnalysis,
    loadFromHistory,
  };

  return <ResumeAnalysisContext.Provider value={value}>{children}</ResumeAnalysisContext.Provider>;
}

export function useResumeAnalysis() {
  const ctx = useContext(ResumeAnalysisContext);
  if (!ctx) {
    throw new Error("useResumeAnalysis must be used within a ResumeAnalysisProvider");
  }
  return ctx;
}
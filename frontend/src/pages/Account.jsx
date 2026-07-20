import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Sparkles,
  Crown,
  Loader2,
  FileText,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  ExternalLink,
  LogOut,
  CreditCard,
  Trash2,
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const PRO_PERKS = [
  "Up to 100 job matches per resume (vs 20 on Basic)",
  "AI-written Suggested Improvements for every resume",
  "Full resume history saved automatically",
  "Priority support",
];

export default function Account() {
  const { user, initializing, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [history, setHistory] = useState(null);
  const [jobDatasets, setJobDatasets] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [activatingId, setActivatingId] = useState(null);
  const [deletingResumeId, setDeletingResumeId] = useState(null);
  const [deletingDatasetId, setDeletingDatasetId] = useState(null);

  useEffect(() => {
    if (!initializing && !user) navigate("/login", { replace: true, state: { from: "/account" } });
  }, [initializing, user, navigate]);

  useEffect(() => {
    if (!user) return;
    api
      .get("/history")
      .then((res) => setHistory(res.data.data))
      .catch(() => setHistory([]));
    api
      .get("/history/job-datasets/list")
      .then((res) => setJobDatasets(res.data.data))
      .catch(() => setJobDatasets([]));
  }, [user]);

  const loadJobDatasets = () => {
    api
      .get("/history/job-datasets/list")
      .then((res) => setJobDatasets(res.data.data))
      .catch(() => setJobDatasets([]));
  };

  const handleActivateDataset = async (id) => {
    setActivatingId(id);
    try {
      await api.post(`/history/job-datasets/${id}/activate`);
      loadJobDatasets();
    } finally {
      setActivatingId(null);
    }
  };

  const handleDeleteResume = async (id) => {
    if (!window.confirm("Delete this resume analysis? This can't be undone.")) return;
    setDeletingResumeId(id);
    try {
      await api.delete(`/history/${id}`);
      setHistory((prev) => (prev || []).filter((item) => item.id !== id));
    } finally {
      setDeletingResumeId(null);
    }
  };

  const handleDeleteDataset = async (id) => {
    if (!window.confirm("Delete this job dataset? If it's your active dataset, your jobs will be cleared too.")) return;
    setDeletingDatasetId(id);
    try {
      await api.delete(`/history/job-datasets/${id}`);
      setJobDatasets((prev) => (prev || []).filter((item) => item.id !== id));
    } finally {
      setDeletingDatasetId(null);
    }
  };

  // After redirect back from Stripe Checkout, synchronously verify + apply
  // the subscription via the checkout session id (doesn't depend on the
  // webhook having fired yet — the classic "payment succeeded but Pro never
  // activated" bug). Falls back to a plain refreshUser if no session_id is
  // present (e.g. an old bookmarked link).
  useEffect(() => {
    if (searchParams.get("checkout") !== "success") return;
    const sessionId = searchParams.get("session_id");
    if (sessionId) {
      api
        .post("/billing/sync-checkout-session", { sessionId })
        .catch(() => {})
        .finally(() => refreshUser());
    } else {
      refreshUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  if (initializing || !user) {
    return (
      <div className="min-h-[calc(100vh-73px)] flex items-center justify-center">
        <Loader2 className="animate-spin text-ink/30" size={28} />
      </div>
    );
  }

  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    try {
      const res = await api.post("/billing/create-checkout-session");
      window.location.href = res.data.data.url;
    } catch {
      setCheckoutLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const res = await api.post("/billing/portal");
      window.location.href = res.data.data.url;
    } catch {
      setPortalLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {searchParams.get("checkout") === "success" && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl2 px-4 py-3 text-sm"
        >
          <CheckCircle2 size={16} /> You're on Pro now — unlimited resume analyses are unlocked.
        </motion.div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-semibold">{user.name || "Account"}</h1>
          <p className="text-sm text-ink/55 mt-1">{user.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-4 py-2 border border-black/15 text-ink/70 hover:bg-black/5 transition-colors"
        >
          <LogOut size={13} /> Log out
        </button>
      </div>

      {/* Subscription card */}
      <div className="glass-card rounded-xl3 p-6 shadow-card mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl2 flex items-center justify-center shadow-glow ${
                user.isPro ? "bg-purple-gradient" : "bg-black/10"
              }`}
            >
              {user.isPro ? <Crown size={18} className="text-white" /> : <Sparkles size={18} className="text-ink/40" />}
            </div>
            <div>
              <p className="font-display font-semibold">
                {user.isPro ? "Pro Plan" : "Free Plan"}
              </p>
              <p className="text-xs text-ink/50">
                {user.isPro
                  ? user.currentPeriodEnd
                    ? `Renews ${new Date(user.currentPeriodEnd).toLocaleDateString()}`
                    : "Active subscription"
                  : "Basic plan — up to 20 job matches per resume"}
              </p>
            </div>
          </div>

          {user.isPro ? (
            <button
              onClick={handleManageBilling}
              disabled={portalLoading}
              className="inline-flex items-center gap-2 text-xs font-semibold rounded-full px-4 py-2.5 border border-black/15 hover:bg-black/5 transition-colors disabled:opacity-60"
            >
              {portalLoading ? <Loader2 size={13} className="animate-spin" /> : <CreditCard size={13} />}
              Manage Billing
            </button>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={checkoutLoading}
              className="inline-flex items-center gap-2 text-xs font-semibold rounded-full px-5 py-2.5 text-white bg-purple-gradient shadow-glow hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {checkoutLoading ? <Loader2 size={13} className="animate-spin" /> : <Crown size={13} />}
              Upgrade to Pro — ₹99/mo
            </button>
          )}
        </div>

        {!user.isPro && (
          <ul className="mt-5 pt-5 border-t border-black/10 space-y-2">
            {PRO_PERKS.map((perk) => (
              <li key={perk} className="flex items-start gap-2 text-xs text-ink/60">
                <CheckCircle2 size={13} className="text-accent-purple mt-0.5 shrink-0" /> {perk}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Resume history */}
      <div>
        <h2 className="font-display font-semibold text-lg mb-4">Resume History</h2>

        {history === null && (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-ink/30" size={22} />
          </div>
        )}

        {history?.length === 0 && (
          <div className="glass-card rounded-xl2 p-8 text-center text-sm text-ink/50 shadow-soft">
            No resume analyses yet — head to the Resume Analyzer to run your first one.
          </div>
        )}

        {history?.length > 0 && (
          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={item.id}
                className="glass-card rounded-xl2 p-4 shadow-soft flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 shrink-0 rounded-xl2 bg-accent-purple/10 text-accent-purple flex items-center justify-center">
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{item.fileName}</p>
                    <p className="text-xs text-ink/45">
                      ATS {item.overallAtsScore} · {item.jobsMatched} matches ·{" "}
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => navigate("/resume-analyzer", { state: { historyId: item.id } })}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-3.5 py-2 border border-black/15 text-ink/70 hover:bg-black/5 transition-colors"
                  >
                    View <ExternalLink size={11} />
                  </button>
                  {item.downloadable && (
                    <a
                      href={`${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/history/${item.id}/download`}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-3.5 py-2 bg-black/5 hover:bg-black/10 transition-colors"
                    >
                      <Download size={11} /> Download
                    </a>
                  )}
                  <button
                    onClick={() => handleDeleteResume(item.id)}
                    disabled={deletingResumeId === item.id}
                    title="Delete this resume analysis"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {deletingResumeId === item.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Job dataset (Excel/CSV) history */}
      <div className="mt-10">
        <h2 className="font-display font-semibold text-lg mb-4">Job Dataset History</h2>

        {jobDatasets === null && (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-ink/30" size={22} />
          </div>
        )}

        {jobDatasets?.length === 0 && (
          <div className="glass-card rounded-xl2 p-8 text-center text-sm text-ink/50 shadow-soft">
            No job datasets uploaded yet — head to the Upload page to add your first one.
          </div>
        )}

        {jobDatasets?.length > 0 && (
          <div className="space-y-3">
            {jobDatasets.map((item) => (
              <div
                key={item.id}
                className="glass-card rounded-xl2 p-4 shadow-soft flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 shrink-0 rounded-xl2 bg-accent-purple/10 text-accent-purple flex items-center justify-center">
                    <FileSpreadsheet size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                      {item.fileName}
                      {item.active && <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />}
                    </p>
                    <p className="text-xs text-ink/45">
                      {item.stats?.inserted ?? item.stats?.total ?? 0} jobs ·{" "}
                      {new Date(item.createdAt).toLocaleDateString()}
                      {item.active ? " · Active" : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleActivateDataset(item.id)}
                    disabled={item.active || activatingId === item.id}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-3.5 py-2 border border-black/15 text-ink/70 hover:bg-black/5 transition-colors disabled:opacity-50"
                  >
                    {activatingId === item.id ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : item.active ? (
                      "Active"
                    ) : (
                      "Use this dataset"
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteDataset(item.id)}
                    disabled={deletingDatasetId === item.id}
                    title="Delete this job dataset"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {deletingDatasetId === item.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

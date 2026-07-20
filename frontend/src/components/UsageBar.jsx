import { useState } from "react";
import { Sparkles, Zap, Lock, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

// Plan-progress pill shown above the resume dropzone / results. Guests never
// see this at all — plan info is an authenticated-only concept now that
// resume analysis requires sign-in. `progress` is the planSnapshot the
// backend returns alongside every analyze/unlock response:
// { isPro, matchesUnlocked, cap, remaining, nextOptions, atCap }.
export default function UsageBar({ progress }) {
  const { user } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    try {
      const res = await api.post("/billing/create-checkout-session");
      window.location.href = res.data.data.url;
    } catch {
      setCheckoutLoading(false);
    }
  };

  if (!user || !progress) return null;

  if (progress.isPro) {
    return (
      <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-accent-purple mb-6">
        <Sparkles size={13} /> Pro plan — {progress.matchesUnlocked} matches unlocked (jump to 20/40/60/80/100 anytime)
      </div>
    );
  }

  const usedToday = Math.max(0, progress.cap - progress.remaining);

  return (
    <div className="flex flex-col items-center gap-1.5 mb-6">
      <div
        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
          progress.atCap ? "bg-amber-50 text-amber-700" : "bg-black/5 text-ink/60"
        }`}
      >
        <Zap size={12} />
        {usedToday} of {progress.cap} daily matches used
        {progress.atCap ? " — resets tomorrow" : ` · ${progress.remaining} more available today`}
      </div>
      {progress.atCap && (
        <button
          onClick={handleUpgrade}
          disabled={checkoutLoading}
          className="text-[11px] font-semibold text-accent-purple hover:underline inline-flex items-center gap-1 disabled:opacity-60"
        >
          {checkoutLoading ? <Loader2 size={11} className="animate-spin" /> : <Lock size={11} />} Upgrade to Pro for unlimited daily matches →
        </button>
      )}
    </div>
  );
}

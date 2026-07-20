import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { History, FileText, Loader2, ChevronDown } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

// Only ever rendered for signed-in users with at least one past resume
// upload — the parent (ResumeAnalyzer) hides this entirely otherwise, per
// spec: guests / logged-out visitors never see an "Upload from History"
// button at all.
export default function HistoryPicker({ onSelect }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null); // null = not fetched yet
  const [loading, setLoading] = useState(false);
  const [pickingId, setPickingId] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api
      .get("/history")
      .then((res) => setItems(res.data.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!user || !items || items.length === 0) return null;

  const handlePick = async (id) => {
    setPickingId(id);
    try {
      const res = await api.get(`/history/${id}`);
      onSelect?.(res.data);
      setOpen(false);
    } finally {
      setPickingId(null);
    }
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3.5 py-2 bg-black/5 hover:bg-black/10 transition-colors"
      >
        <History size={13} /> Upload from History <ChevronDown size={12} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute z-20 mt-2 w-72 glass-card rounded-xl2 shadow-card p-2 max-h-80 overflow-y-auto"
          >
            {loading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={16} className="animate-spin text-ink/40" />
              </div>
            )}
            {!loading &&
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePick(item.id)}
                  disabled={pickingId === item.id}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl2 hover:bg-black/5 transition-colors disabled:opacity-50"
                >
                  <div className="w-8 h-8 shrink-0 rounded-lg bg-accent-purple/10 text-accent-purple flex items-center justify-center">
                    {pickingId === item.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <FileText size={14} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{item.fileName}</p>
                    <p className="text-[10px] text-ink/45">
                      ATS {item.overallAtsScore} · {item.jobsMatched} matches ·{" "}
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </button>
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

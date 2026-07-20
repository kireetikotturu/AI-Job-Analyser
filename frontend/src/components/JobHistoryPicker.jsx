import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { History, FileSpreadsheet, Loader2, ChevronDown, CheckCircle2 } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

// Job-dataset counterpart to <HistoryPicker> (which is resume-only). Only
// ever rendered for signed-in users with at least one past Excel/CSV
// upload — automatically appears the moment history exists, and lets a
// user swap back to a previous dataset without re-uploading the file.
export default function JobHistoryPicker({ onActivated }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null); // null = not fetched yet
  const [loading, setLoading] = useState(false);
  const [activatingId, setActivatingId] = useState(null);
  const ref = useRef(null);

  const load = () => {
    if (!user) return;
    setLoading(true);
    api
      .get("/history/job-datasets/list")
      .then((res) => setItems(res.data.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [user]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!user || !items || items.length === 0) return null;

  const handleActivate = async (id) => {
    setActivatingId(id);
    try {
      const res = await api.post(`/history/job-datasets/${id}/activate`);
      onActivated?.(res.data.stats);
      setOpen(false);
      load(); // refresh which item shows as "Active"
    } catch {
      // non-fatal — picker stays open so the user can retry
    } finally {
      setActivatingId(null);
    }
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
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
            onClick={(e) => e.stopPropagation()}
            className="absolute z-20 mt-2 w-80 glass-card rounded-xl2 shadow-card p-2 max-h-80 overflow-y-auto text-left"
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
                  onClick={() => handleActivate(item.id)}
                  disabled={activatingId === item.id || item.active}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl2 hover:bg-black/5 transition-colors disabled:opacity-60"
                >
                  <div className="w-8 h-8 shrink-0 rounded-lg bg-accent-purple/10 text-accent-purple flex items-center justify-center">
                    {activatingId === item.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <FileSpreadsheet size={14} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate flex items-center gap-1.5">
                      {item.fileName}
                      {item.active && <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />}
                    </p>
                    <p className="text-[10px] text-ink/45">
                      {item.stats?.inserted ?? item.stats?.total ?? 0} jobs ·{" "}
                      {new Date(item.createdAt).toLocaleDateString()}
                      {item.active ? " · Active" : ""}
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

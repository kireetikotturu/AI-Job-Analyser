import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="w-9 h-9 rounded-full bg-white/80 border border-black/10 flex items-center justify-center disabled:opacity-30"
      >
        <ChevronLeft size={15} />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`w-9 h-9 rounded-full text-sm font-semibold transition-colors ${
            p === page ? "bg-purple-gradient text-white" : "bg-white/80 border border-black/10 hover:bg-black/5"
          }`}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="w-9 h-9 rounded-full bg-white/80 border border-black/10 flex items-center justify-center disabled:opacity-30"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

import { Loader2 } from "lucide-react";

export default function Loader({ label = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-ink/50">
      <Loader2 className="animate-spin text-accent-purple" size={28} />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

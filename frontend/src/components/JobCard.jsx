import { motion } from "framer-motion";
import { Building2, MapPin, IndianRupee, BadgeCheck, ExternalLink, GraduationCap } from "lucide-react";
import { getApplyHref } from "../utils/applyLink";

export default function JobCard({ job, onView, delay = 0 }) {
  const applyHref = getApplyHref(job.applyLink);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.04, duration: 0.35 }}
      whileHover={{ y: -5 }}
      className="glass-card rounded-xl3 p-5 shadow-card flex flex-col gap-3"
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 shrink-0 rounded-xl2 bg-purple-gradient flex items-center justify-center text-white font-bold font-display">
          {job.company?.[0]?.toUpperCase() || "J"}
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-[15px] leading-snug truncate">{job.jobTitle}</h3>
          <p className="text-xs text-ink/50 flex items-center gap-1 mt-0.5">
            <Building2 size={12} /> {job.company}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[11px] text-ink/60">
        <span className="pill">
          <MapPin size={11} /> {job.location}
        </span>
        <span className="pill">
          <IndianRupee size={11} /> {job.salary}
        </span>
        <span className="pill">
          <BadgeCheck size={11} /> {job.experience}
        </span>
        {job.education && job.education !== "Not specified" && (
          <span className="pill max-w-[220px]" title={job.education}>
            <GraduationCap size={11} className="shrink-0" />
            <span className="truncate">{job.education}</span>
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(job.skills || []).slice(0, 4).map((s) => (
          <span
            key={s}
            className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-accent-purple/10 text-accent-purple"
          >
            {s}
          </span>
        ))}
        {job.skills?.length > 4 && (
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-black/5 text-ink/50">
            +{job.skills.length - 4}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={() => onView(job)}
          className="flex-1 text-xs font-semibold rounded-full py-2.5 bg-black/5 hover:bg-black/10 transition-colors"
        >
          View Details
        </button>
        {applyHref ? (
          <a
            href={applyHref}
            target="_blank"
            rel="noreferrer"
            className="flex-1 text-xs font-semibold rounded-full py-2.5 bg-purple-gradient text-white text-center hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
          >
            Apply <ExternalLink size={12} />
          </a>
        ) : (
          <button
            type="button"
            disabled
            title="No apply link available for this job"
            className="flex-1 text-xs font-semibold rounded-full py-2.5 bg-black/5 text-ink/30 cursor-not-allowed flex items-center justify-center gap-1"
          >
            No link
          </button>
        )}
      </div>
    </motion.div>
  );
}

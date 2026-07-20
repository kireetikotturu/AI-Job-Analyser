import { AnimatePresence, motion } from "framer-motion";
import { X, MapPin, Building2, IndianRupee, BadgeCheck, ExternalLink, Clock, GraduationCap } from "lucide-react";
import { getApplyHref } from "../utils/applyLink";

export default function Modal({ job, onClose }) {
  const applyHref = job ? getApplyHref(job.applyLink) : null;

  return (
    <AnimatePresence>
      {job && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: "spring", duration: 0.4 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-cream rounded-xl3 max-w-lg w-full p-7 shadow-2xl relative max-h-[85vh] overflow-y-auto"
          >
            <button
              onClick={onClose}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl2 bg-purple-gradient flex items-center justify-center text-white font-bold font-display text-lg">
                {job.company?.[0]?.toUpperCase()}
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold">{job.jobTitle}</h2>
                <p className="text-sm text-ink/50">{job.company}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <InfoRow icon={MapPin} label="Location" value={job.location} />
              <InfoRow icon={IndianRupee} label="Salary" value={job.salary} />
              <InfoRow icon={BadgeCheck} label="Experience" value={job.experience} />
              <InfoRow icon={Clock} label="Type" value={job.employmentType} />
              {job.education && job.education !== "Not specified" && (
                <InfoRow icon={GraduationCap} label="Education" value={job.education} />
              )}
            </div>

            <div className="mb-5">
              <p className="text-xs font-semibold text-ink/50 mb-2 uppercase tracking-wide">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {(job.skills || []).map((s) => (
                  <span
                    key={s}
                    className="text-xs font-medium px-2.5 py-1 rounded-full bg-accent-purple/10 text-accent-purple"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {job.description && (
              <div className="mb-6">
                <p className="text-xs font-semibold text-ink/50 mb-2 uppercase tracking-wide">Description</p>
                <p className="text-sm text-ink/70 leading-relaxed">{job.description}</p>
              </div>
            )}

            {applyHref ? (
              <a
                href={applyHref}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 rounded-full py-3 bg-purple-gradient text-white font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                Apply Now <ExternalLink size={14} />
              </a>
            ) : (
              <button
                type="button"
                disabled
                title="No apply link available for this job"
                className="w-full flex items-center justify-center gap-2 rounded-full py-3 bg-black/5 text-ink/30 font-semibold text-sm cursor-not-allowed"
              >
                No apply link available
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="glass-card rounded-xl2 p-3 flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-accent-purple/10 text-accent-purple flex items-center justify-center shrink-0">
        <Icon size={14} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-ink/40 font-medium uppercase">{label}</p>
        <p className="text-xs font-semibold truncate">{value}</p>
      </div>
    </div>
  );
}

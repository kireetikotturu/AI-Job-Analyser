import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, UploadCloud, LayoutDashboard, Briefcase, FileSearch, Crown, User } from "lucide-react";
import { useResumeAnalysis } from "../context/ResumeAnalysisContext";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/", label: "Upload", icon: UploadCloud },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/jobs", label: "All Jobs", icon: Briefcase },
  { to: "/resume-analyzer", label: "Resume Analyzer", icon: FileSearch },
];

export default function Navbar() {
  const { loading } = useResumeAnalysis();
  const { user, isPro, initializing } = useAuth();
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-cream/80 border-b border-black/5">
      <nav className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl2 bg-purple-gradient flex items-center justify-center shadow-glow">
            <Sparkles size={18} className="text-white" />
          </div>
          <span className="font-display text-xl font-semibold tracking-tight">Accio AI Lens</span>
        </div>

        <div className="hidden md:flex items-center gap-1 glass-card rounded-full px-1.5 py-1.5 shadow-soft">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `relative flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  isActive ? "text-white" : "text-ink/70 hover:text-ink"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-full bg-purple-gradient -z-10"
                      transition={{ type: "spring", duration: 0.5 }}
                    />
                  )}
                  <Icon size={15} />
                  {label}
                  {to === "/resume-analyzer" && loading && (
                    <span className="relative flex h-2 w-2 ml-0.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {!initializing && user ? (
            <NavLink
              to="/account"
              className="flex items-center gap-1.5 text-xs font-semibold rounded-full pl-2 pr-3 py-1.5 bg-black/5 hover:bg-black/10 transition-colors"
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-white ${
                  isPro ? "bg-purple-gradient" : "bg-ink/40"
                }`}
              >
                {isPro ? <Crown size={12} /> : <User size={12} />}
              </span>
              {user.name?.split(" ")[0] || "Account"}
            </NavLink>
          ) : (
            !initializing && (
              <div className="flex items-center gap-2">
                <NavLink to="/login" className="text-xs font-semibold text-ink/60 hover:text-ink transition-colors">
                  Log in
                </NavLink>
                <NavLink
                  to="/signup"
                  className="text-xs font-semibold rounded-full px-4 py-2 bg-purple-gradient text-white shadow-glow hover:opacity-90 transition-opacity"
                >
                  Sign up
                </NavLink>
              </div>
            )
          )}
        </div>
      </nav>
    </header>
  );
}

import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Mail, Lock, LogIn, Loader2, XCircle, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      const redirectTo = location.state?.from || "/account";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-73px)] bg-hero-gradient flex items-center justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-card rounded-xl3 p-8 shadow-card"
      >
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-11 h-11 rounded-xl2 bg-purple-gradient flex items-center justify-center shadow-glow mb-3">
            <Sparkles size={18} className="text-white" />
          </div>
          <h1 className="font-display text-2xl font-semibold">Welcome back</h1>
          <p className="text-sm text-ink/55 mt-1">Log in to see your resume history and Pro usage.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-ink/60 mb-1.5 block">Email</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl2 bg-white border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple/40"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-ink/60 mb-1.5 block">Password</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl2 bg-white border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple/40"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl2 px-3 py-2.5 text-xs">
              <XCircle size={14} /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white bg-purple-gradient shadow-glow hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />}
            Log In
          </button>
        </form>

        <p className="text-center text-xs text-ink/55 mt-6">
          Don't have an account?{" "}
          <Link to="/signup" className="font-semibold text-accent-purple hover:underline">
            Sign up
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

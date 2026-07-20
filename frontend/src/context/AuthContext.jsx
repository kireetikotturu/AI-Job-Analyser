import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // On first load, silently check whether the httpOnly session cookie is
  // still valid. A 401 here just means "logged out" — not an error.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/auth/me");
        if (!cancelled) setUser(res.data.data);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Bug fix: after a full-page redirect away and back (Stripe Checkout,
  // Stripe Billing Portal), the browser can restore this page from the
  // back/forward cache (bfcache) instead of truly reloading it. bfcache
  // brings back the exact JS memory snapshot from the moment we left —
  // including whatever `user` was sitting in this context back then. If
  // you'd logged out/switched accounts since that snapshot was taken,
  // you'd see that frozen (wrong/stale) account until something forced a
  // re-fetch. `pageshow` with `event.persisted === true` is the standard
  // way to detect "this page just came from bfcache" and re-verify the
  // real session with the server instead of trusting the snapshot.
  useEffect(() => {
    const handlePageShow = (event) => {
      if (!event.persisted) return;
      api
        .get("/auth/me")
        .then((res) => setUser(res.data.data))
        .catch(() => setUser(null));
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const signup = useCallback(async (name, email, password) => {
    const res = await api.post("/auth/signup", { name, email, password });
    setUser(res.data.data);
    return res.data.data;
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    setUser(res.data.data);
    return res.data.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
    }
  }, []);

  // Called after a successful Stripe checkout redirect back to /account, so
  // the Pro badge/limits update without waiting for the next full page load.
  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data.data);
    } catch {
      setUser(null);
    }
  }, []);

  const value = { user, isPro: Boolean(user?.isPro), initializing, signup, login, logout, refreshUser };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
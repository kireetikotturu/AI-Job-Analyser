const crypto = require("crypto");
const User = require("../models/User");
const { COOKIE_NAME, ANON_COOKIE_NAME, verifyToken, anonCookieOptions } = require("../utils/token");

async function loadUserFromToken(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub);
    return user || null;
  } catch {
    return null; // expired/invalid — treat as logged out rather than erroring
  }
}

// Attaches req.user if a valid session cookie is present, but never blocks
// the request either way. Used on routes that behave the same for guests
// and logged-in users but need to know which one they're serving (resume
// analysis, so it can save history only for logged-in users).
async function optionalAuth(req, res, next) {
  req.user = await loadUserFromToken(req);

  // Every visitor — logged in or not — gets a stable anonymous id so the
  // free-tier usage limiter has something to key off of before signup.
  if (!req.cookies?.[ANON_COOKIE_NAME]) {
    req.anonId = crypto.randomUUID();
    res.cookie(ANON_COOKIE_NAME, req.anonId, anonCookieOptions());
  } else {
    req.anonId = req.cookies[ANON_COOKIE_NAME];
  }
  next();
}

// Hard requirement — rejects the request if there's no valid session.
// Used for /history, /billing, /auth/me.
async function protect(req, res, next) {
  const user = await loadUserFromToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: "Please log in to continue." });
  }
  req.user = user;
  next();
}

module.exports = { optionalAuth, protect };

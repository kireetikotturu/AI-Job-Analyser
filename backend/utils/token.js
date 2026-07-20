const jwt = require("jsonwebtoken");

const COOKIE_NAME = "jm_token";
const ANON_COOKIE_NAME = "jm_anon";

function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "30d",
  });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

// httpOnly JWT cookie — the whole point is the browser can't read it via JS,
// only send it back automatically, which is what makes this safer than
// localStorage for session tokens.
function authCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd, // requires HTTPS in production; localhost stays http in dev
    sameSite: isProd ? "none" : "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: "/",
  };
}

// Anonymous device id — NOT used for auth/identity, only so the free-tier
// rate limiter can recognize "the same visitor" across requests before they
// ever sign up. Deliberately not httpOnly since it carries no secret.
function anonCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: false,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    path: "/",
  };
}

module.exports = {
  COOKIE_NAME,
  ANON_COOKIE_NAME,
  signToken,
  verifyToken,
  authCookieOptions,
  anonCookieOptions,
};

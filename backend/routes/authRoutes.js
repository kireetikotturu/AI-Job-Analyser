const express = require("express");
const router = express.Router();
const { signup, login, logout, me } = require("../controllers/authController");
const { protect } = require("../middleware/auth");

// Auth responses must never be cached — a cached /auth/me response could
// show a stale user after a login/logout swap, same root cause as the
// bfcache issue AuthContext now guards against on the frontend.
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

router.post("/auth/signup", signup);
router.post("/auth/login", login);
router.post("/auth/logout", logout);
router.get("/auth/me", protect, me);

module.exports = router;
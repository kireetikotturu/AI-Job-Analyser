const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { signToken, COOKIE_NAME, authCookieOptions } = require("../utils/token");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Name is required." });
    }
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, message: "A valid email is required." });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: "An account with that email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
    });

    const token = signToken(user._id);
    res.cookie(COOKIE_NAME, token, authCookieOptions());
    res.status(201).json({ success: true, data: user.toSafeJSON() });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ success: false, message: "Could not create account. Please try again." });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    // Same generic message whether the email doesn't exist or the password
    // is wrong — don't leak which one it was.
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const token = signToken(user._id);
    res.cookie(COOKIE_NAME, token, authCookieOptions());
    res.json({ success: true, data: user.toSafeJSON() });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Login failed. Please try again." });
  }
};

const logout = (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...authCookieOptions(), maxAge: undefined });
  res.json({ success: true });
};

const me = (req, res) => {
  res.json({ success: true, data: req.user.toSafeJSON() });
};

module.exports = { signup, login, logout, me };

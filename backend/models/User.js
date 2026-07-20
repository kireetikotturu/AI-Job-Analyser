const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      unique: true,
      index: true,
    },
    passwordHash: { type: String, required: true },

    // --- Stripe / subscription state, kept in sync via webhook ---
    stripeCustomerId: { type: String, default: null, index: true },
    stripeSubscriptionId: { type: String, default: null },
    // Mirrors Stripe's subscription.status ("active", "trialing", "past_due",
    // "canceled", "incomplete", etc). Only "active" and "trialing" count as Pro.
    subscriptionStatus: { type: String, default: "none" },
    currentPeriodEnd: { type: Date, default: null },

    // --- Daily job-match budget (Basic plan only) ---
    // Basic users get a shared 20-matches-per-day budget across EVERY
    // resume they analyze that day, not a fresh 20 per resume upload.
    // `dailyMatchDate` is a "YYYY-MM-DD" key; `dailyMatchCount` is how much
    // of that day's budget has been consumed so far (both initial reveals
    // and "unlock more" increments add to it). Reset automatically the
    // first time either is read/written on a new day.
    dailyMatchDate: { type: String, default: null },
    dailyMatchCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

UserSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

UserSchema.methods.isPro = function () {
  return ["active", "trialing"].includes(this.subscriptionStatus);
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// How many of today's Basic-plan match budget has already been used,
// across all resumes analyzed today. Rolls over to 0 automatically once
// the stored date no longer matches today.
UserSchema.methods.getDailyMatchesUsed = function () {
  return this.dailyMatchDate === todayKey() ? this.dailyMatchCount || 0 : 0;
};

// Records newly-revealed matches (initial analysis or "unlock more") against
// today's budget. Caller is responsible for calling `.save()` afterwards.
UserSchema.methods.addDailyMatches = function (amount) {
  const today = todayKey();
  if (this.dailyMatchDate !== today) {
    this.dailyMatchDate = today;
    this.dailyMatchCount = 0;
  }
  this.dailyMatchCount += amount;
};

// Never leak the hash (or internal Stripe ids) to the client.
UserSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    isPro: this.isPro(),
    subscriptionStatus: this.subscriptionStatus,
    currentPeriodEnd: this.currentPeriodEnd,
  };
};

module.exports = mongoose.model("User", UserSchema);

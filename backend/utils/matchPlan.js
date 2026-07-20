// Progressive job-match plan rules (replaces the old "2 analyses per 4
// hours" free-tier limiter now that resume analysis requires sign-in).
//
// Basic plan: capped at 20 total matches PER DAY, shared across every
// resume analyzed that day (not reset by uploading a new resume), unlocked
// in steps of 5. Pro plan: no daily cap — each resume gets its own dropdown
// straight to 20/40/60/80/100 total matches.
const BASIC_INITIAL = 5;
const BASIC_STEP = 5;
const BASIC_CAP = 20; // daily budget for Basic plans

const PRO_INITIAL = 20;
const PRO_OPTIONS = [20, 40, 60, 80, 100];
const PRO_MAX = Math.max(...PRO_OPTIONS);

// Initial reveal size for a brand-new resume upload. Basic plans start at
// 5 but never exceed what's left of today's shared 20-match budget (could
// be less than 5, or 0 if the day's budget is already spent).
function initialTotal(isPro, remainingToday) {
  if (isPro) return PRO_INITIAL;
  return Math.max(0, Math.min(BASIC_INITIAL, remainingToday));
}

// Options the frontend dropdown should offer, given the plan, how many
// matches are already unlocked on THIS resume, and how much of today's
// shared budget is left (Basic only).
function nextOptions(isPro, unlocked, remainingToday) {
  if (isPro) {
    // Pro dropdown only ever offers HIGHER tiers than what's already
    // unlocked — no point letting someone "unlock" back down to a
    // smaller count. Once at the max tier (100), there's nothing left to
    // unlock, so the frontend should hide the whole control (empty array).
    if (unlocked >= PRO_MAX) return [];
    return PRO_OPTIONS.filter((total) => total > unlocked);
  }
  const remaining = Math.max(0, remainingToday);
  const steps = [];
  for (let add = BASIC_STEP; add <= remaining; add += BASIC_STEP) {
    steps.push(add); // "+5", "+10", "+15" — additive, relative to `unlocked`
  }
  return steps;
}

// Validates a requested total/additional match count against plan rules.
// `requested` is an ABSOLUTE total for Pro, or an ADDITIVE amount for Basic
// (the frontend sends whichever the dropdown represents for that plan).
// `remainingToday` (Basic only) is what's left of today's shared 20-match
// budget BEFORE this request.
function resolveRequestedTotal(isPro, unlocked, requested, remainingToday) {
  const n = Number(requested);
  if (!Number.isFinite(n) || n <= 0) return null;

  if (isPro) {
    if (!PRO_OPTIONS.includes(n)) return null;
    if (n <= unlocked) return null; // no stepping down or re-requesting the same tier
    return n;
  }

  if (n % BASIC_STEP !== 0) return null;
  if (n > remainingToday) return null;
  return unlocked + n;
}

function planSnapshot(isPro, unlocked, remainingToday) {
  return {
    isPro,
    matchesUnlocked: unlocked,
    cap: isPro ? null : BASIC_CAP,
    remaining: isPro ? null : Math.max(0, remainingToday),
    nextOptions: nextOptions(isPro, unlocked, remainingToday),
    atCap: isPro ? unlocked >= PRO_MAX : remainingToday <= 0,
  };
}

module.exports = {
  BASIC_INITIAL,
  BASIC_STEP,
  BASIC_CAP,
  PRO_INITIAL,
  PRO_OPTIONS,
  PRO_MAX,
  initialTotal,
  nextOptions,
  resolveRequestedTotal,
  planSnapshot,
};
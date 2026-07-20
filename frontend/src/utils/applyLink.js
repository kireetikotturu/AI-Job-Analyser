/**
 * Safely resolve a job's applyLink into something that is actually
 * openable in a new tab.
 *
 * Why this exists:
 * Previously every "Apply" button did `href={job.applyLink || "#"}`.
 * Whenever applyLink was missing/empty (very common — many uploaded
 * datasets don't have an apply/link/url column, or the row simply
 * didn't include one), the href fell back to "#". Combined with
 * target="_blank", clicking that button opens a NEW TAB pointed at
 * the CURRENT page's URL + "#" — which looks exactly like "Apply
 * redirects to the same page" rather than doing nothing or erroring.
 *
 * Also, some datasets store links without a scheme (e.g.
 * "naukri.com/job/123" instead of "https://naukri.com/job/123").
 * Browsers treat that as a *relative* URL, so it resolves against the
 * current app URL instead of the external site — which also looks
 * like "redirecting to the wrong page" (the app tries to route to
 * "/naukri.com/job/123" internally).
 *
 * This helper returns `null` when there's no usable link (so the UI
 * can disable the button instead of silently reloading itself), and
 * normalizes missing-scheme links so they actually leave the app.
 */
export function getApplyHref(rawLink) {
  if (!rawLink) return null;
  const trimmed = String(rawLink).trim();
  if (!trimmed || trimmed === "#") return null;

  // Already has a scheme (http:, https:, mailto:, etc.) — leave it alone.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;

  // Looks like a bare domain/path (e.g. "naukri.com/job/123") — add https://
  return `https://${trimmed}`;
}

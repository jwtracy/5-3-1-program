// All "today"/date logic is pinned to Pacific time so it's correct regardless of
// the server timezone (the prod VM runs UTC).
const TZ = "America/Los_Angeles";

/** Today's date in Pacific time as an ISO YYYY-MM-DD string. */
export function todayISO(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/**
 * Render an ISO date like "Tue, Jun 24". Built from the date components via
 * Date.UTC + timeZone:"UTC" so the rendered day matches the ISO string exactly,
 * with no server-timezone shift.
 */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Day of week for an ISO date (0 = Sunday … 6 = Saturday). UTC-based, no skew. */
export function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Add `n` days to an ISO date, returning a new ISO YYYY-MM-DD string (UTC). */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Whole days between two ISO dates (a - b). UTC-based, so DST never skews it. */
export function daysBetween(aISO: string, bISO: string): number {
  const [ay, am, ad] = aISO.split("-").map(Number);
  const [by, bm, bd] = bISO.split("-").map(Number);
  const a = Date.UTC(ay, am - 1, ad);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.round((a - b) / 86_400_000);
}

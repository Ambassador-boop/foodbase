/**
 * West-African-Time helpers (UTC+1, no DST).
 *
 * The platform settles balances at 05:00 WAT every weekday morning.
 * Settlement rules (chosen by the business owner):
 *   - Payment on Mon, Tue, Wed, Thu  -> available the NEXT day at 05:00 WAT
 *   - Payment on Fri, Sat, Sun       -> available the NEXT MONDAY at 05:00 WAT
 *
 * All comparisons are done by working in a "WAT-shifted" Date so we don't
 * have to fight the host server's timezone.
 */

const WAT_OFFSET_MINUTES = 60; // UTC+1
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Returns a Date object whose UTC fields represent WAT wall-clock time. */
function toWatWall(d: Date): Date {
  return new Date(d.getTime() + WAT_OFFSET_MINUTES * 60 * 1000);
}

/** Inverse of toWatWall: takes WAT-wall-clock fields and returns a real UTC Date. */
function fromWatWall(d: Date): Date {
  return new Date(d.getTime() - WAT_OFFSET_MINUTES * 60 * 1000);
}

/**
 * Given a payment timestamp, computes the UTC Date at which the funds
 * should become available in available_balance.
 *
 *   Mon..Thu  -> next day  05:00 WAT
 *   Fri,Sat,Sun -> Monday   05:00 WAT
 */
export function computeAvailableAt(paidAt: Date | string): Date {
  const paid = typeof paidAt === 'string' ? new Date(paidAt) : paidAt;
  const watWall = toWatWall(paid);

  // Day of week using WAT wall clock (0 = Sun, 1 = Mon, ... 6 = Sat)
  const dow = watWall.getUTCDay();

  let daysToAdd: number;
  if (dow === 1 || dow === 2 || dow === 3 || dow === 4) {
    daysToAdd = 1; // Mon-Thu -> next day
  } else if (dow === 5) {
    daysToAdd = 3; // Fri -> Mon
  } else if (dow === 6) {
    daysToAdd = 2; // Sat -> Mon
  } else {
    daysToAdd = 1; // Sun -> Mon
  }

  // Build a WAT wall-clock Date for "paid day + daysToAdd at 05:00:00".
  const target = new Date(
    Date.UTC(
      watWall.getUTCFullYear(),
      watWall.getUTCMonth(),
      watWall.getUTCDate() + daysToAdd,
      5,
      0,
      0,
      0,
    ),
  );

  // Convert that WAT wall clock back into a real UTC instant.
  return fromWatWall(target);
}

/** Formats a date in WAT (UTC+1) for display in the dashboard. */
export function formatWat(
  input: Date | string | null | undefined,
  opts: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  },
): string {
  if (!input) return '—';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('en-NG', {
      ...opts,
      timeZone: 'Africa/Lagos',
    }).format(d);
  } catch {
    // Fallback for older runtimes
    return toWatWall(d).toUTCString().replace(' GMT', ' WAT');
  }
}

/** Short variant for compact rows. */
export function formatWatShort(input: Date | string | null | undefined): string {
  return formatWat(input, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/** Now in real UTC. Useful in tests / cron. */
export function nowUtc(): Date {
  return new Date();
}

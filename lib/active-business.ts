import { cookies } from 'next/headers';
import { getOne } from './db';
import { getCurrentUser } from './auth';

export const ACTIVE_BUSINESS_COOKIE = 'current_business_id';

/**
 * Resolve the business that the current request should operate on.
 *
 * Order of resolution:
 *   1. The `current_business_id` cookie (set by `/api/user/switch-business`),
 *      provided the user actually owns that business.
 *   2. The owner's oldest business (deterministic fallback).
 *
 * This is the single source of truth used by every dashboard API route, so
 * switching a business in one place propagates to everywhere.
 */
export async function getActiveBusiness(): Promise<any | null> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== 'business_owner') return null;

  return getActiveBusinessForUser(currentUser.id);
}

export async function getActiveBusinessForUser(
  userId: string,
): Promise<any | null> {
  const cookieStore = await cookies();
  const cookieBusinessId = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value;

  if (cookieBusinessId) {
    const owned = await getOne(
      'SELECT * FROM businesses WHERE id = $1 AND owner_id = $2',
      [cookieBusinessId, userId],
    );
    if (owned) return owned;
  }

  // Deterministic fallback: oldest business first so the same business is
  // returned across requests when no cookie has been set yet.
  return getOne(
    `SELECT * FROM businesses
     WHERE owner_id = $1
     ORDER BY created_at ASC
     LIMIT 1`,
    [userId],
  );
}

/**
 * Convenience helper that throws if the user has no business at all.
 */
export async function requireActiveBusiness() {
  const business = await getActiveBusiness();
  if (!business) {
    throw new Error('No business found for current user');
  }
  return business;
}

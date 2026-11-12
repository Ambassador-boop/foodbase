-- ============================================================================
-- FoodBase — Batch 3A (restaurant registration, onboarding, opening hours)
--
-- Run this ONCE in the Neon SQL editor BEFORE merging the batch-3a branch.
-- Read it first: it is additive only.
--   * every object uses IF NOT EXISTS
--   * every new column is nullable or has a default
--   * no existing row is updated, no column is dropped, no type is changed
--   * no payment, refund, settlement, withdrawal or auth object is touched
--
-- The application code does not require this to have run: each new feature
-- degrades to "not configured yet" when its table or column is absent.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Email verification state on users (non-blocking; access is never gated)
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 2. Verification tokens. Only the SHA-256 hash of the token is stored.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(21) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user
  ON email_verification_tokens (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Terms / privacy acceptance audit trail
--    One row per accepted registration, keeping the document versions that
--    were shown at the time so a later policy revision can be diffed.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registration_consents (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(21),
  business_id VARCHAR(21),
  email VARCHAR(255) NOT NULL,
  terms_version VARCHAR(32) NOT NULL,
  privacy_version VARCHAR(32) NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address VARCHAR(64),
  user_agent VARCHAR(400)
);

CREATE INDEX IF NOT EXISTS idx_registration_consents_user
  ON registration_consents (user_id, accepted_at DESC);

-- ---------------------------------------------------------------------------
-- 4. Registration rate limiting (IP + email). DB-backed so it works across
--    serverless instances. Rows older than the longest window can be deleted
--    at any time; the app also prunes opportunistically.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registration_attempts (
  id VARCHAR(32) PRIMARY KEY,
  bucket VARCHAR(16) NOT NULL,      -- 'ip' | 'email'
  identifier VARCHAR(255) NOT NULL, -- hashed, never the raw address
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registration_attempts_lookup
  ON registration_attempts (bucket, identifier, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5. Opening hours, stored per day (0 = Sunday .. 6 = Saturday).
--    businesses.availability (JSONB) still exists and is mirrored on save so
--    the current storefront info panel keeps working unchanged.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_hours (
  id VARCHAR(32) PRIMARY KEY,
  business_id VARCHAR(21) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_closed BOOLEAN NOT NULL DEFAULT TRUE,
  open_time TIME,
  close_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_business_hours_business
  ON business_hours (business_id);

-- Accepting orders outside opening hours stays ON by default (no behaviour
-- change for existing businesses).
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS accept_orders_outside_hours BOOLEAN NOT NULL DEFAULT TRUE;

-- ---------------------------------------------------------------------------
-- 6. Onboarding skips. Non-critical steps may be skipped, never blocked.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onboarding_skips (
  id VARCHAR(32) PRIMARY KEY,
  business_id VARCHAR(21) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  step_key VARCHAR(40) NOT NULL,
  skipped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, step_key)
);

COMMIT;

-- ============================================================================
-- Rollback (only if you must; none of this is referenced by old code paths):
--
--   DROP TABLE IF EXISTS onboarding_skips;
--   DROP TABLE IF EXISTS business_hours;
--   DROP TABLE IF EXISTS registration_attempts;
--   DROP TABLE IF EXISTS registration_consents;
--   DROP TABLE IF EXISTS email_verification_tokens;
--   ALTER TABLE businesses DROP COLUMN IF EXISTS accept_orders_outside_hours;
--   ALTER TABLE users DROP COLUMN IF EXISTS email_verified_at;
--   ALTER TABLE users DROP COLUMN IF EXISTS email_verified;
-- ============================================================================

/**
 * Environment validation, in one place.
 *
 * Every variable the application reads is declared here and split in two:
 *
 *  - server only (this file). Importing it from a client component would be a
 *    mistake, and Next.js would not inline the values anyway.
 *  - public (lib/env-public.ts, re-exported as `env.public`), which are the
 *    NEXT_PUBLIC_* values that legitimately reach the browser.
 *
 * In production a missing required variable stops the process at start-up with
 * a message that names the variables and nothing else. Values are never
 * printed, logged or included in an error, here or anywhere downstream.
 *
 * Tests are the one exception: when `NODE_ENV === 'test'` every server value is
 * optional, because the suites in tests/unit are pure logic and must be able to
 * import a module without a database or a signing key. No test is allowed to
 * reach the network or the database, so an empty value can never be used by
 * mistake in one of them.
 */

import { z } from 'zod';
import { publicEnv } from './env-public';

const isTest = process.env.NODE_ENV === 'test';
const isProduction = process.env.NODE_ENV === 'production';
/**
 * `next build` imports every route to collect metadata, and the build machine
 * does not have the production values. The build is not serving requests, so it
 * is exempt; the first request on a deployment validates properly and stops the
 * process there if something is missing.
 */
const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
const relaxed = isTest || isBuild;

/** A string that must be present and non-empty. */
const required = z.string().min(1);
/** A string that may be absent. Empty string counts as absent. */
const optional = z
  .string()
  .optional()
  .transform((value) => (value === '' ? undefined : value));

const serverSchema = z.object({
  // Database. Required everywhere except tests; nothing works without it.
  DATABASE_URL: relaxed ? optional.default('') : required,

  // Auth. Required except in tests; see the note at the top of the file.
  JWT_SECRET: relaxed ? optional.default('') : required,

  // Payments. Required in production: the platform handles live money, and a
  // missing key would silently disable payment, refund and payout calls.
  PAYSTACK_SECRET_KEY: isProduction && !isBuild ? required : optional,

  // Images.
  CLOUDINARY_API_KEY: optional,
  CLOUDINARY_API_SECRET: optional,

  // Email.
  BREVO_API_KEY: optional,
  BREVO_EMAIL: optional,
  ADMIN_NOTIFICATION_EMAIL: optional,

  // Push notifications (OneSignal via Median).
  ONESIGNAL_REST_API_KEY: optional,

  // Maps.
  MAPBOX_TOKEN: optional,

  // SMS.
  KUDISMS_TOKEN: optional,
  KUDISMS_FUNDING_ACCOUNT_NUMBER: optional,
  KUDISMS_FUNDING_EXPECTED_NAME: optional,

  // Push notification sound overrides (read by lib/onesignal-sound.ts).
  ONESIGNAL_IOS_SOUND: optional,
  ONESIGNAL_PUSH_SOUND: optional,
  ONESIGNAL_ANDROID_CHANNEL_ID: optional,
  ONESIGNAL_IOS_INTERRUPTION_LEVEL: optional,
  ONESIGNAL_IOS_BADGE_TYPE: optional,
  ONESIGNAL_IOS_BADGE_COUNT: optional,

  // Feature overrides (read by lib/features.ts).
  FEATURE_DELIVERY_AREAS: optional,
  FEATURE_TABLE_LABELS: optional,
  FEATURE_SOUND_TEST: optional,

  // Operations.
  CRON_SECRET: optional,
  BETTERSTACK_HEARTBEAT_URL: optional,
  RATE_LIMIT_SALT: optional,
  PIN_ENFORCEMENT: optional,
});

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: optional,
  NEXT_PUBLIC_BASE_URL: optional,
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: optional,
  NEXT_PUBLIC_ONESIGNAL_APP_ID: optional,
  NEXT_PUBLIC_MAPBOX_TOKEN: optional,
});

export type ServerEnv = z.infer<typeof serverSchema>;

/**
 * Names only, never values. Zod issue paths are the variable names, so the
 * message is safe to print in a server log.
 */
function describeIssues(error: z.ZodError): string {
  const names = Array.from(new Set(error.issues.map((issue) => String(issue.path[0] ?? 'unknown'))));
  return names.join(', ');
}

function readServerEnv(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Missing or invalid environment variable(s): ${describeIssues(parsed.error)}. ` +
        'Set them in .env.local for development, or in the Vercel project settings for a deployment. ' +
        'See docs/environment.md. Values are never printed.',
    );
  }
  return parsed.data;
}

function readPublicEnv(): z.infer<typeof publicSchema> {
  // Public values are allowed to be absent: a missing map token or push app id
  // disables that feature, it does not stop the app. Shape is still checked so
  // a non-string cannot leak in from a bad build configuration.
  const parsed = publicSchema.safeParse(publicEnv);
  if (!parsed.success) {
    throw new Error(`Invalid public environment variable(s): ${describeIssues(parsed.error)}.`);
  }
  return parsed.data;
}

/**
 * Validation runs on the server only. A client bundle that imports this module
 * (lib/cloudinary.ts is the one mixed case) gets an empty server half: the
 * values would be `undefined` in a browser anyway, and Next.js never inlines
 * anything without the NEXT_PUBLIC_ prefix. Nothing in the browser reads them.
 */
const isBrowser = typeof window !== 'undefined';
const server: ServerEnv = isBrowser ? ({} as ServerEnv) : readServerEnv();
const pub = readPublicEnv();

/**
 * One object to import from. Variable names are kept identical to the
 * environment so a read is easy to trace: `env.PAYSTACK_SECRET_KEY`.
 */
export const env = {
  ...server,
  ...pub,
  /** True when NODE_ENV is production. */
  isProduction,
  /** True when NODE_ENV is test (Vitest sets this). */
  isTest,
  /** Public half, for code that wants the browser-safe subset explicitly. */
  public: pub,
} as const;

export type Env = typeof env;

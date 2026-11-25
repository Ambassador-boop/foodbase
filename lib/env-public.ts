/**
 * Public environment variables: anything compiled into the browser bundle.
 *
 * These are read with literal `process.env.NEXT_PUBLIC_*` expressions because
 * that is the only form Next.js replaces at build time. A dynamic lookup
 * (`process.env[name]`) would be `undefined` in the browser, so do not
 * "simplify" this into a loop.
 *
 * Nothing secret may live here. Server-only variables are in lib/env.ts.
 */

export const publicEnv = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  NEXT_PUBLIC_ONESIGNAL_APP_ID: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
  NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
} as const;

export type PublicEnv = typeof publicEnv;

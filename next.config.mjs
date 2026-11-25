/** @type {import('next').NextConfig} */

/**
 * Every third-party origin this app talks to, grouped by what it is for.
 *
 * Collected by searching the code, not from memory:
 *  - Paystack: js.paystack.co (inline script), checkout.paystack.com (hosted
 *    checkout frame), api.paystack.co (transfers, refunds, bank resolve).
 *  - Mapbox: api.mapbox.com (mapbox-gl JS, CSS, tiles, geocoding),
 *    events.mapbox.com (usage telemetry from the GL library), blob: workers
 *    (mapbox-gl spawns its worker from a blob URL).
 *  - OneSignal: cdn.onesignal.com (SDK), api.onesignal.com / onesignal.com
 *    (subscription and notification REST calls).
 *  - Cloudinary: res.cloudinary.com (delivered images),
 *    api.cloudinary.com (signed uploads from the browser).
 *  - Unsplash: images.unsplash.com (editorial photography).
 *  - Vercel: va.vercel-scripts.com (Analytics script) and
 *    vitals.vercel-insights.com (Analytics beacon).
 *  - KudiSMS / Brevo are server to server only, so they are not in the policy.
 */
const PAYSTACK = ['https://js.paystack.co', 'https://checkout.paystack.com', 'https://api.paystack.co'];
const MAPBOX = ['https://api.mapbox.com', 'https://events.mapbox.com'];
const ONESIGNAL = ['https://cdn.onesignal.com', 'https://api.onesignal.com', 'https://onesignal.com'];
const CLOUDINARY = ['https://res.cloudinary.com', 'https://api.cloudinary.com'];
const UNSPLASH = ['https://images.unsplash.com'];
const VERCEL = ['https://va.vercel-scripts.com', 'https://vitals.vercel-insights.com'];

/**
 * Report-Only for this first deployment: nothing is blocked, every violation is
 * reported to /api/csp-report so the policy can be tightened from real traffic
 * rather than guesses. 'unsafe-inline' and 'unsafe-eval' are here for Next.js's
 * own hydration script and the dev overlay; they are the first things to remove
 * once a nonce is in place.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: ${[...PAYSTACK, ...MAPBOX, ...ONESIGNAL, ...VERCEL].join(' ')}`,
  `style-src 'self' 'unsafe-inline' ${[...MAPBOX, ...ONESIGNAL].join(' ')}`,
  `img-src 'self' data: blob: ${[...CLOUDINARY, ...UNSPLASH, ...MAPBOX, ...ONESIGNAL, ...PAYSTACK].join(' ')}`,
  `font-src 'self' data:`,
  `connect-src 'self' ${[...PAYSTACK, ...MAPBOX, ...ONESIGNAL, ...CLOUDINARY, ...VERCEL].join(' ')}`,
  `frame-src 'self' ${PAYSTACK.join(' ')}`,
  `worker-src 'self' blob:`,
  `media-src 'self' blob: ${CLOUDINARY.join(' ')}`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  'upgrade-insecure-requests',
  'report-uri /api/csp-report',
].join('; ');

const securityHeaders = [
  // Two years, subdomains included. The site is HTTPS only on Vercel.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // The delivery map needs location; nothing in the app records audio or video.
  { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=()' },
  // Report-Only does not enforce frame-ancestors, so framing is blocked by the
  // header below while the policy gathers reports. Both say the same thing.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy-Report-Only', value: csp },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Type errors now fail the build. `tsc --noEmit` is also a package script.
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    // Optimisation is on: Cloudinary and Unsplash are optimised and resized by
    // Next, and every stored Cloudinary URL matches the pattern below.
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

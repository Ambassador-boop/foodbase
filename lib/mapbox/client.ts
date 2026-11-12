'use client';

/**
 * Mapbox GL loader (Batch 3B).
 *
 * The library is loaded from Mapbox's own CDN at the moment a map is actually
 * rendered, instead of being added to the bundle. Two reasons:
 *
 *  - Checkout must not carry ~800KB of map code for the majority of orders that
 *    are eaten at the restaurant.
 *  - A failed load is a normal state here, not an exception: every screen using
 *    this loader has a non-map path, and the token can be absent entirely.
 *
 * The token is the same public one Mapbox requires in the browser. No secret is
 * passed through this module.
 */

const GL_VERSION = '3.8.0';
const DRAW_VERSION = '1.5.0';

type LoadState = 'idle' | 'loading' | 'ready' | 'failed';

let glPromise: Promise<any | null> | null = null;
let drawPromise: Promise<any | null> | null = null;

export function mapboxPublicToken(): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const trimmed = (token ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function hasMapboxToken(): boolean {
  return mapboxPublicToken() !== null;
}

function injectCss(href: string) {
  if (typeof document === 'undefined') return;
  if (document.querySelector(`link[data-mapbox-css="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.mapboxCss = href;
  document.head.appendChild(link);
}

function injectScript(src: string, globalName: string): Promise<any | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  const existing = (window as any)[globalName];
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const selector = `script[data-mapbox-src="${src}"]`;
    const already = document.querySelector<HTMLScriptElement>(selector);
    if (already) {
      already.addEventListener('load', () => resolve((window as any)[globalName] ?? null));
      already.addEventListener('error', () => resolve(null));
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.mapboxSrc = src;
    script.addEventListener('load', () => resolve((window as any)[globalName] ?? null));
    script.addEventListener('error', () => resolve(null));
    document.head.appendChild(script);
  });
}

/** Resolves with the `mapboxgl` namespace, or null when maps cannot load. */
export function loadMapboxGl(): Promise<any | null> {
  if (glPromise) return glPromise;

  const token = mapboxPublicToken();
  if (!token) {
    glPromise = Promise.resolve(null);
    return glPromise;
  }

  injectCss(`https://api.mapbox.com/mapbox-gl-js/v${GL_VERSION}/mapbox-gl.css`);
  glPromise = injectScript(
    `https://api.mapbox.com/mapbox-gl-js/v${GL_VERSION}/mapbox-gl.js`,
    'mapboxgl',
  ).then((mapboxgl) => {
    if (!mapboxgl) return null;
    try {
      mapboxgl.accessToken = token;
    } catch {
      return null;
    }
    return mapboxgl;
  });

  return glPromise;
}

/** Polygon drawing tools, loaded only by the delivery area editor. */
export function loadMapboxDraw(): Promise<any | null> {
  if (drawPromise) return drawPromise;
  injectCss(`https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v${DRAW_VERSION}/mapbox-gl-draw.css`);
  drawPromise = injectScript(
    `https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v${DRAW_VERSION}/mapbox-gl-draw.js`,
    'MapboxDraw',
  );
  return drawPromise;
}

export type { LoadState };

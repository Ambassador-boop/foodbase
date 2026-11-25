import type { MetadataRoute } from 'next'

/**
 * Web app manifest, as specified by the logo kit's placement sheet.
 *
 * The four icons come from public/icons/. The two maskable files exist because
 * Android crops a launcher icon to whatever shape the launcher uses; a maskable
 * icon carries the safe zone that keeps the mark uncropped.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FoodBase',
    short_name: 'FoodBase',
    start_url: '/',
    display: 'standalone',
    background_color: '#FBF7F1',
    theme_color: '#8C3800',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}

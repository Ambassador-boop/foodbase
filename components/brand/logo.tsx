import { MARK_GLYPH_PATH, WORDMARK_PATH } from '@/components/brand/logo-paths'

/**
 * The FoodBase logo.
 *
 * The artwork is inlined rather than served as an image so it stays sharp at
 * every size and so a caller can drop it into a coloured surface without a
 * second request. It is a server component: no hooks, no client bundle.
 *
 * Tones, straight from the logo kit's usage rules:
 *  - `brown`    brown disc, cream mark, brown wordmark. Light backgrounds.
 *  - `ink`      brown disc, cream mark, ink wordmark. Light backgrounds where
 *               the wordmark should sit at text weight.
 *  - `on-dark`  cream disc, brown mark, cream wordmark. Brown and dark
 *               backgrounds.
 *
 * The mark alone is used wherever the available width is under 160 px; the
 * lockup has a hard minimum of 120 px wide, and below that the wordmark stops
 * being legible.
 */

const BROWN = '#8C3800'
const CREAM = '#FCECD4'
const INK = '#1F1611'

const TONES = {
  brown: { disc: BROWN, glyph: CREAM, wordmark: BROWN },
  ink: { disc: BROWN, glyph: CREAM, wordmark: INK },
  'on-dark': { disc: CREAM, glyph: BROWN, wordmark: CREAM },
} as const

export type LogoVariant = 'mark' | 'lockup'
export type LogoTone = keyof typeof TONES

export type LogoProps = {
  variant?: LogoVariant
  tone?: LogoTone
  /** Rendered height in pixels. Width follows the artwork's aspect ratio. */
  size?: number
  className?: string
  /** Set false only when the logo sits next to a text name that already says it. */
  decorative?: boolean
}

/** 1713 / 260, the lockup's aspect ratio. */
const LOCKUP_RATIO = 1713 / 260

/**
 * One clip path, shared by every instance. The shape is identical in each, so a
 * repeated id resolves to the same circle and renders correctly; this avoids
 * generating a random id (which would need a client hook) or serialising a
 * second copy of the path per instance.
 */
const CLIP_ID = 'foodbase-mark-clip'

function MarkArtwork({ tone }: { tone: LogoTone }) {
  const colours = TONES[tone]
  return (
    <>
      <defs>
        <clipPath id={CLIP_ID}>
          <circle cx="500" cy="500" r="500" />
        </clipPath>
      </defs>
      <circle cx="500" cy="500" r="500" fill={colours.disc} />
      <path clipPath={`url(#${CLIP_ID})`} fill={colours.glyph} d={MARK_GLYPH_PATH} />
    </>
  )
}

export function Logo({
  variant = 'lockup',
  tone = 'brown',
  size = variant === 'mark' ? 32 : 28,
  className,
  decorative = false,
}: LogoProps) {
  const a11y = decorative
    ? { 'aria-hidden': true as const, focusable: 'false' as const }
    : { role: 'img' as const, 'aria-label': 'FoodBase' }

  if (variant === 'mark') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1000 1000"
        width={size}
        height={size}
        className={className}
        {...a11y}
      >
        <MarkArtwork tone={tone} />
      </svg>
    )
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1713 260"
      width={Math.round(size * LOCKUP_RATIO)}
      height={size}
      className={className}
      {...a11y}
    >
      <g transform="scale(0.26)">
        <MarkArtwork tone={tone} />
      </g>
      <path transform="translate(330,235.0)" fill={TONES[tone].wordmark} d={WORDMARK_PATH} />
    </svg>
  )
}

export default Logo

import * as React from 'react'
import { MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * MapContainer
 *
 * A deliberate placeholder SLOT for the delivery-area map. It renders a calm,
 * gridded surface with the address set in type, never a fake map screenshot and
 * never a stock pin illustration. Batch 3B swaps `children` for a real map
 * component; the slot keeps the exact height so the page does not jump.
 *
 * Rules for whoever fills the slot:
 *  - the provider's own attribution stays visible
 *  - the marker label is the business name, not "Your location"
 *  - keyboard users can reach the map container (tabIndex=0) and it has a label
 */
export function MapContainer({
  label,
  address,
  hint,
  aspect = '16 / 9',
  children,
  className,
  footer,
}: {
  /** Accessible name for the region, e.g. "Delivery area map". */
  label: string
  address?: string | null
  hint?: string
  /** CSS aspect-ratio. Defaults to 16/9; use "4 / 3" in narrow side columns. */
  aspect?: string
  children?: React.ReactNode
  className?: string
  footer?: React.ReactNode
}) {
  return (
    <figure className={cn('min-w-0', className)}>
      <div
        role="region"
        aria-label={label}
        tabIndex={children ? 0 : -1}
        className="relative w-full overflow-hidden rounded-[10px] border border-[var(--dash-line)] bg-[var(--dash-surface-inset)]"
        style={{ aspectRatio: aspect }}
      >
        {children ?? (
          <>
            {/* Survey grid: drawn in CSS so there is no image to load or mislead. */}
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-[0.55]"
              style={{
                backgroundImage:
                  'linear-gradient(to right, var(--dash-line) 1px, transparent 1px), linear-gradient(to bottom, var(--dash-line) 1px, transparent 1px)',
                backgroundSize: '28px 28px',
              }}
            />
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-1/3"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(115deg, transparent 0 22px, var(--dash-line) 22px 23px)',
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
              <span className="flex size-8 items-center justify-center rounded-full border border-[var(--dash-line-strong)] bg-[var(--dash-surface)] text-[var(--dash-brown)]">
                <MapPin className="size-4" aria-hidden="true" />
              </span>
              <p className="max-w-[34ch] text-[12.5px] leading-[1.5] text-[var(--dash-ink-2)]">
                {address || 'No address saved for this location yet'}
              </p>
              {hint ? <p className="max-w-[38ch] text-[11.5px] leading-[1.45] text-[var(--dash-ink-4)]">{hint}</p> : null}
            </div>
          </>
        )}
      </div>
      {footer ? <figcaption className="mt-2 text-[11.5px] leading-[1.45] text-[var(--dash-ink-3)]">{footer}</figcaption> : null}
    </figure>
  )
}

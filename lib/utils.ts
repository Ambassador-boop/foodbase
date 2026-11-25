import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * Class merging, taught the design system's own vocabulary.
 *
 * tailwind-merge resolves ambiguous utilities by looking the value up in the
 * default Tailwind scales. It does not know `brand-600`, `ink`, `paper` or
 * `primary-foreground`, so it treated `text-primary-foreground` as a font SIZE
 * and silently dropped it whenever a size class such as `text-small` came
 * later. The visible symptom was white button labels rendering in ink.
 *
 * Registering the colours below is what keeps that from happening again, in any
 * component, without having to remember the order of classes.
 */
const COLOURS = [
  'inherit',
  'current',
  'transparent',
  'black',
  'white',
  // Brand ramp
  'brand-50',
  'brand-100',
  'brand-200',
  'brand-300',
  'brand-400',
  'brand-500',
  'brand-600',
  'brand-700',
  'brand-800',
  'brand-900',
  // Roles
  'paper',
  'surface',
  'line',
  'line-strong',
  'ink',
  'ink-muted',
  // Status
  'success',
  'success-soft',
  'warning',
  'warning-soft',
  'danger',
  'danger-soft',
  'info',
  'info-soft',
  'neutral',
  'neutral-soft',
  // shadcn names
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
  'link',
  // Charts and sidebar
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'sidebar',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
]

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: COLOURS,
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateAlphanumericId(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

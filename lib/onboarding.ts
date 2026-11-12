import { getAll, getOne } from '@/lib/db'
import { getPinStatus } from '@/lib/security/pin'
import { featureAvailable, featureBatch } from '@/lib/features'

/**
 * Onboarding checklist.
 *
 * Rule that shapes everything below: every "done" flag is computed from data
 * that already exists in the product. Nothing is stored except the owner's
 * decision to skip a step they do not need. That means the checklist is always
 * truthful, and it repairs itself if a record is deleted later.
 *
 * No step blocks the dashboard. Locked steps are capabilities that ship in a
 * later batch; they are detected from the filesystem, never hard-coded.
 */

export type OnboardingStepKey =
  | 'profile'
  | 'payout'
  | 'pin'
  | 'menu'
  | 'hours'
  | 'delivery_areas'
  | 'table_labels'
  | 'notifications'

export type OnboardingStatus = 'done' | 'todo' | 'skipped' | 'locked'

export type OnboardingStep = {
  key: OnboardingStepKey
  title: string
  why: string
  minutes: number
  /** Critical steps still cannot block the dashboard; they only cannot be skipped. */
  critical: boolean
  href?: string
  status: OnboardingStatus
  lockedReason?: string
  /** Where the capability ships, when locked. */
  batch?: string
}

export type OnboardingSummary = {
  steps: OnboardingStep[]
  progress: {
    done: number
    total: number
    percent: number
    complete: boolean
    skipped: number
    locked: number
  }
}

type BusinessRow = {
  id: string
  name: string | null
  slug: string | null
  description: string | null
  logo_url: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  bank_account_number: string | null
  bank_code: string | null
  bank_account_holder: string | null
  accept_orders_outside_hours?: boolean | null
}

function rowsOf<T>(raw: any): T[] {
  return Array.isArray(raw) ? raw : (raw?.rows ?? [])
}

async function countRows(sql: string, params: unknown[]): Promise<number | null> {
  try {
    const row = await getOne(sql, params)
    if (!row) return 0
    const value = (row as Record<string, unknown>).n ?? (row as Record<string, unknown>).count
    return Number(value ?? 0)
  } catch {
    return null
  }
}

async function skippedSteps(businessId: string): Promise<Set<string>> {
  try {
    const rows = await getAll('SELECT step_key FROM onboarding_skips WHERE business_id = $1', [businessId])
    return new Set(rowsOf<{ step_key: string }>(rows).map((row) => row.step_key))
  } catch {
    // Table not migrated yet: nobody has skipped anything.
    return new Set()
  }
}

export async function buildOnboarding(business: BusinessRow, userId: string): Promise<OnboardingSummary> {
  const businessId = business.id

  const [
    categoryCount,
    itemCount,
    openDays,
    skippedKeys,
    pin,
    // Batch 3B: null means "the table is not there yet", which reads as "not done".
    deliveryAreaCount,
    tableLabelCount,
  ] = await Promise.all([
    countRows('SELECT COUNT(*)::int AS n FROM categories WHERE business_id = $1', [businessId]),
    countRows('SELECT COUNT(*)::int AS n FROM menu_items WHERE business_id = $1', [businessId]),
    countRows('SELECT COUNT(*)::int AS n FROM business_hours WHERE business_id = $1 AND is_closed = false', [businessId]),
    skippedSteps(businessId),
    getPinStatus(userId).catch(() => ({ hasPin: false, locked: false, lockedUntil: null })),
    countRows(
      'SELECT COUNT(*)::int AS n FROM delivery_areas WHERE business_id = $1 AND is_active = true',
      [businessId],
    ),
    countRows(
      'SELECT COUNT(*)::int AS n FROM table_labels WHERE business_id = $1 AND is_active = true',
      [businessId],
    ),
  ])

  const profileDone = Boolean(
    business.name && business.name.trim().length > 1 && business.logo_url && business.description && business.description.trim().length > 10,
  )
  const payoutDone = Boolean(
    business.bank_account_number && business.bank_code && business.bank_account_holder,
  )
  const pinDone = Boolean(pin?.hasPin)
  const menuDone = (categoryCount ?? 0) > 0 && (itemCount ?? 0) > 0
  // null means "business_hours is not there yet", so we cannot claim it is done.
  const hoursDone = (openDays ?? 0) > 0

  const deliveryAvailable = featureAvailable('deliveryAreas')
  const tablesAvailable = featureAvailable('tableLabels')
  const soundAvailable = featureAvailable('soundTest')

  const raw: Array<Omit<OnboardingStep, 'status'> & { done: boolean; locked?: boolean }> = [
    {
      key: 'profile',
      title: 'Add your restaurant profile and logo',
      why: 'Customers decide in the first two seconds. A name, a one-line description and a square logo are what they see at the top of your storefront.',
      minutes: 3,
      critical: true,
      href: '/dashboard/profile',
      done: profileDone,
    },
    {
      key: 'payout',
      title: 'Add the bank account for payouts',
      why: 'Card payments cannot reach you without a verified NUBAN. We resolve the account name with Paystack before saving it, so a typo is caught immediately.',
      minutes: 3,
      critical: true,
      href: '/dashboard/finance',
      done: payoutDone,
    },
    {
      key: 'pin',
      title: 'Set your withdrawal PIN',
      why: 'The six-digit PIN is what stops someone with your password from moving money. Bank-detail changes and withdrawals both require it.',
      minutes: 2,
      critical: true,
      href: '/dashboard/security',
      done: pinDone,
    },
    {
      key: 'menu',
      title: 'Add a category and your first dishes',
      why: 'A storefront with no dishes stays unlisted. One category with three or four items is enough to take a first order tonight.',
      minutes: 8,
      critical: true,
      href: '/dashboard/menu',
      done: menuDone,
    },
    {
      key: 'hours',
      title: 'Set your opening hours',
      why: 'Hours show as open or closed on your storefront and set customer expectations. Orders outside those hours are still accepted by default, so a late order is never lost.',
      minutes: 2,
      critical: false,
      href: '/dashboard/hours',
      done: hoursDone,
    },
    {
      key: 'delivery_areas',
      title: 'Set delivery areas and prices',
      why: 'A delivery fee per area is more accurate than one flat fee. It also stops orders from streets you cannot reach in time.',
      minutes: 4,
      critical: false,
      href: '/dashboard/delivery',
      done: (deliveryAreaCount ?? 0) > 0,
      locked: !deliveryAvailable,
      lockedReason: deliveryAvailable
        ? undefined
        : 'Delivery areas are being built. Until then, delivery fees are set per order at checkout.',
      batch: deliveryAvailable ? undefined : featureBatch('deliveryAreas'),
    },
    {
      key: 'table_labels',
      title: 'Add table labels',
      why: 'Labels let a dine-in order name the table it belongs to, so runners do not have to guess.',
      minutes: 2,
      critical: false,
      href: '/dashboard/tables',
      done: (tableLabelCount ?? 0) > 0,
      locked: !tablesAvailable,
      lockedReason: tablesAvailable ? undefined : 'Table labels arrive with the dine-in tools.',
      batch: tablesAvailable ? undefined : featureBatch('tableLabels'),
    },
    {
      key: 'notifications',
      title: 'Turn on order alerts and run the sound test',
      why: 'An order that nobody hears is a refund. Alerts fire on this device, and the sound test proves they will be audible during service.',
      minutes: 2,
      critical: false,
      done: false,
      locked: !soundAvailable,
      lockedReason: soundAvailable
        ? undefined
        : 'Notification settings are available now. The one-tap sound test ships with the notification work.',
      batch: soundAvailable ? undefined : featureBatch('soundTest'),
    },
  ]

  const steps: OnboardingStep[] = raw.map(({ done, locked, ...step }) => {
    if (locked) return { ...step, status: 'locked' as const }
    if (done) return { ...step, status: 'done' as const }
    if (skippedKeys.has(step.key)) return { ...step, status: 'skipped' as const }
    return { ...step, status: 'todo' as const }
  })

  // Progress ignores steps the product cannot finish yet, otherwise "complete"
  // would be unreachable until a later batch ships.
  const available = steps.filter((step) => step.status !== 'locked')
  const done = available.filter((step) => step.status === 'done').length
  const skippedCount = steps.filter((step) => step.status === 'skipped').length

  return {
    steps,
    progress: {
      done,
      total: available.length,
      percent: available.length === 0 ? 100 : Math.round((done / available.length) * 100),
      complete: available.length > 0 && done === available.length,
      skipped: skippedCount,
      locked: steps.length - available.length,
    },
  }
}

/** Steps an owner is allowed to skip. Critical steps must be finished. */
export const SKIPPABLE: OnboardingStepKey[] = ['hours', 'delivery_areas', 'table_labels', 'notifications']

export const STEP_TITLES: Record<string, string> = {
  profile: 'Restaurant profile and logo',
  payout: 'Bank account for payouts',
  pin: 'Withdrawal PIN',
  menu: 'Menu and first dishes',
  hours: 'Opening hours',
  delivery_areas: 'Delivery areas',
  table_labels: 'Table labels',
  notifications: 'Notifications and sound test',
}

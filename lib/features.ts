import fs from 'node:fs'
import path from 'node:path'

/**
 * Feature checks.
 *
 * The onboarding checklist must show "Coming next" for capabilities that do not
 * exist yet WITHOUT hard-coding a boolean that someone has to remember to flip.
 * Each check looks for the route (or API) that would back the feature on disk,
 * so the day Batch 3B merges its delivery-areas page, the step becomes live on
 * its own.
 *
 * An env override (FEATURE_DELIVERY_AREAS=on) exists for deployments where the
 * app source is not present in the runtime bundle.
 */

export type FeatureKey = 'deliveryAreas' | 'tableLabels' | 'soundTest'

const ROUTES: Record<FeatureKey, string[]> = {
  deliveryAreas: ['dashboard', 'delivery'],
  tableLabels: ['dashboard', 'tables'],
  soundTest: ['dashboard', 'notifications', 'sound'],
}

const ENV: Record<FeatureKey, string> = {
  deliveryAreas: 'FEATURE_DELIVERY_AREAS',
  tableLabels: 'FEATURE_TABLE_LABELS',
  soundTest: 'FEATURE_SOUND_TEST',
}

const cache = new Map<FeatureKey, boolean>()

export function featureAvailable(key: FeatureKey): boolean {
  const override = process.env[ENV[key]]
  if (override === 'on' || override === '1' || override === 'true') return true
  if (override === 'off' || override === '0' || override === 'false') return false

  const cached = cache.get(key)
  if (cached !== undefined) return cached

  let exists = false
  try {
    exists = fs.existsSync(path.join(process.cwd(), 'app', ...ROUTES[key]))
  } catch {
    exists = false
  }
  cache.set(key, exists)
  return exists
}

/** Batch label shown next to a locked step, so the owner knows it is planned. */
export function featureBatch(key: FeatureKey): string {
  if (key === 'soundTest') return 'Batch 3C'
  return 'Batch 3B'
}

/**
 * Per-device settings for the kitchen display, and for the alert sound anywhere
 * in the dashboard. They live in `localStorage` on purpose: a pass tablet in a
 * loud kitchen wants the alert loud, the office laptop does not, and neither of
 * those is a restaurant-wide setting the owner should have to pick once.
 *
 * Everything is validated on read. Corrupt or older stored values fall back to
 * the defaults rather than throwing on a device that is being used mid-service.
 */

export type KitchenTheme = 'auto' | 'light' | 'dark';

export interface KitchenThresholds {
  /** Minutes after payment when a ticket starts to look urgent. */
  attention: number;
  /** Minutes when a ticket reads as over target. */
  over: number;
  /** Minutes when it reads as well over target. */
  wellOver: number;
}

export interface KitchenDeviceSettings {
  sound: boolean;
  /** 0–1. */
  volume: number;
  thresholds: KitchenThresholds;
  /** How long a ready ticket stays on the pass before rolling into the drawer. */
  readyHoldMinutes: number;
  bigType: boolean;
  theme: KitchenTheme;
}

export const DEFAULT_KITCHEN_SETTINGS: KitchenDeviceSettings = {
  sound: true,
  volume: 0.7,
  thresholds: { attention: 10, over: 18, wellOver: 28 },
  readyHoldMinutes: 20,
  bigType: false,
  theme: 'auto',
};

const STORAGE_KEY = 'foodbase.kitchen.settings.v1';
/** The orders page reads the sound preference from here too. */
export const KITCHEN_SOUND_KEY = STORAGE_KEY;

function clampMinutes(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(240, Math.max(1, Math.round(parsed)));
}

export function normaliseKitchenSettings(input: unknown): KitchenDeviceSettings {
  const raw = (input ?? {}) as Partial<KitchenDeviceSettings> & { thresholds?: Partial<KitchenThresholds> };
  const attention = clampMinutes(raw.thresholds?.attention, DEFAULT_KITCHEN_SETTINGS.thresholds.attention);
  const over = Math.max(attention + 1, clampMinutes(raw.thresholds?.over, DEFAULT_KITCHEN_SETTINGS.thresholds.over));
  const wellOver = Math.max(over + 1, clampMinutes(raw.thresholds?.wellOver, DEFAULT_KITCHEN_SETTINGS.thresholds.wellOver));
  const volume = Number(raw.volume);
  const theme: KitchenTheme = raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : 'auto';
  return {
    sound: typeof raw.sound === 'boolean' ? raw.sound : DEFAULT_KITCHEN_SETTINGS.sound,
    volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : DEFAULT_KITCHEN_SETTINGS.volume,
    thresholds: { attention, over, wellOver },
    readyHoldMinutes: clampMinutes(raw.readyHoldMinutes, DEFAULT_KITCHEN_SETTINGS.readyHoldMinutes),
    bigType: typeof raw.bigType === 'boolean' ? raw.bigType : DEFAULT_KITCHEN_SETTINGS.bigType,
    theme,
  };
}

export function loadKitchenSettings(): KitchenDeviceSettings {
  if (typeof window === 'undefined') return DEFAULT_KITCHEN_SETTINGS;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_KITCHEN_SETTINGS;
    return normaliseKitchenSettings(JSON.parse(stored));
  } catch {
    return DEFAULT_KITCHEN_SETTINGS;
  }
}

export function saveKitchenSettings(settings: KitchenDeviceSettings): KitchenDeviceSettings {
  const normalised = normaliseKitchenSettings(settings);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalised));
    } catch {
      // Private mode or a full quota: the board keeps working in memory.
    }
  }
  return normalised;
}

export function patchKitchenSettings(
  current: KitchenDeviceSettings,
  patch: Partial<KitchenDeviceSettings>,
): KitchenDeviceSettings {
  return saveKitchenSettings({ ...current, ...patch, thresholds: { ...current.thresholds, ...(patch.thresholds ?? {}) } });
}

export type KitchenUrgency = 'calm' | 'attention' | 'over' | 'well-over';

/**
 * How a ticket should read, given how long it has been paid for. Driven by the
 * device's thresholds, never by a hard-coded red/green light.
 */
export function urgencyFor(elapsedMinutes: number, thresholds: KitchenThresholds): KitchenUrgency {
  if (elapsedMinutes >= thresholds.wellOver) return 'well-over';
  if (elapsedMinutes >= thresholds.over) return 'over';
  if (elapsedMinutes >= thresholds.attention) return 'attention';
  return 'calm';
}

export function formatElapsed(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

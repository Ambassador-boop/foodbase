'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { loadKitchenSettings, saveKitchenSettings } from '@/lib/kitchen/device-settings';
import { playKitchenAlert, primeKitchenAudio } from '@/lib/kitchen/sound';

/**
 * The same alert the kitchen board uses, on the orders page (Batch 3C, item b4).
 *
 * It watches the list it is given for an order id it has never seen whose payment
 * has cleared, and rings once. It never rings for an unpaid order, and it never
 * rings about orders that were already on screen when the page opened.
 */

type SoundableOrder = { id: string; payment_status?: string | null };

function isPaid(status: string | null | undefined): boolean {
  const value = String(status ?? '').trim().toLowerCase();
  return value === 'paid' || value === 'completed';
}

export function useNewPaidOrderSound(orders: SoundableOrder[] | undefined): void {
  const seenRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!orders) return;
    if (seenRef.current === null) {
      // First render: everything on screen is history, not news.
      seenRef.current = new Set(orders.map((order) => order.id));
      return;
    }
    const fresh = orders.filter((order) => !seenRef.current!.has(order.id));
    if (fresh.length === 0) return;
    for (const order of fresh) seenRef.current.add(order.id);

    const settings = loadKitchenSettings();
    if (!settings.sound) return;
    if (!fresh.some((order) => isPaid(order.payment_status))) return;

    void primeKitchenAudio().then((ready) => {
      if (ready) playKitchenAlert({ urgency: 'new', volume: settings.volume });
    });
  }, [orders]);
}

/** Mute for this device, shared with the kitchen board. */
export function KitchenSoundToggle() {
  const [enabled, setEnabled] = useState(() => loadKitchenSettings().sound);
  const [volume, setVolume] = useState(() => loadKitchenSettings().volume);

  useEffect(() => {
    const settings = loadKitchenSettings();
    setEnabled(settings.sound);
    setVolume(settings.volume);
  }, []);

  const toggle = useCallback(async () => {
    const current = loadKitchenSettings();
    const next = { ...current, sound: !current.sound };
    saveKitchenSettings(next);
    setEnabled(next.sound);
    if (next.sound) {
      const ready = await primeKitchenAudio();
      if (ready) playKitchenAlert({ urgency: 'test', volume: next.volume });
    }
  }, []);

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={enabled}
      className={`inline-flex h-10 items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors ${
        enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground hover:bg-muted/70'
      }`}
      title={enabled ? `Alert sound on (${Math.round(volume * 100)}%)` : 'Alert sound muted on this device'}
    >
      {enabled ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}
      {enabled ? 'Sound on' : 'Sound off'}
    </button>
  );
}

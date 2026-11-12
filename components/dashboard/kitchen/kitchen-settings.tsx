'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Toggle } from '@/components/dashboard';
import {
  DEFAULT_KITCHEN_SETTINGS,
  normaliseKitchenSettings,
  type KitchenDeviceSettings,
  type KitchenThresholds,
  type KitchenTheme,
} from '@/lib/kitchen/device-settings';

export interface KitchenSettingsSheetProps {
  settings: KitchenDeviceSettings;
  soundSupported: boolean;
  onChange: (next: KitchenDeviceSettings) => void;
  onClose: () => void;
  onTestSound: () => void;
}

const THEMES: { key: KitchenTheme; label: string }[] = [
  { key: 'auto', label: 'Auto' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

/**
 * Everything here is stored on this device only. A pass tablet and an office
 * laptop need different volume and different ideas of "late"; neither should
 * overwrite the other.
 */
export function KitchenSettingsSheet({
  settings,
  soundSupported,
  onChange,
  onClose,
  onTestSound,
}: KitchenSettingsSheetProps) {
  const [draft, setDraft] = useState(settings);

  useEffect(() => setDraft(settings), [settings]);

  const patch = (
    next: Partial<Omit<KitchenDeviceSettings, 'thresholds'>> & { thresholds?: Partial<KitchenThresholds> },
  ) => {
    const merged = normaliseKitchenSettings({
      ...draft,
      ...next,
      thresholds: { ...draft.thresholds, ...(next.thresholds ?? {}) },
    });
    setDraft(merged);
    onChange(merged);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div
        className="kds-scrim"
        style={{ background: 'rgba(20, 17, 14, 0.32)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="kds-sheet" role="dialog" aria-modal="true" aria-labelledby="kds-settings-title">
        <div className="kds-sheet__head">
          <div>
            <h2 className="kds-sheet__title" id="kds-settings-title">
              Kitchen display settings
            </h2>
            <p className="kds-sheet__hint">Saved on this device only.</p>
          </div>
          <button type="button" className="kds-btn kds-btn--icon" onClick={onClose} aria-label="Close settings">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="kds-toggle-row" style={{ borderTop: 0 }}>
          <span>
            Alert sound
            <span className="kds-toggle-row__hint">
              {soundSupported
                ? 'A short tone when a paid order arrives, repeated every 30 seconds while a new ticket is untouched.'
                : 'This browser has no Web Audio support, so the board will stay silent.'}
            </span>
          </span>
          <Toggle
            id="kds-sound"
            label="Alert sound"
            checked={draft.sound && soundSupported}
            onChange={(next) => patch({ sound: next })}
          />
        </div>

        <label className="kds-field" htmlFor="kds-volume">
          <span className="kds-field__label">Volume</span>
          <input
            id="kds-volume"
            className="kds-field__input"
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(draft.volume * 100)}
            onChange={(event) => patch({ volume: Number(event.target.value) / 100 })}
            style={{ padding: 0 }}
          />
          <span className="kds-field__hint">{Math.round(draft.volume * 100)}% · set the tablet's own volume first, then this.</span>
        </label>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button type="button" className="kds-btn" onClick={onTestSound}>
            Play test sound
          </button>
        </div>

        <h3 className="kds-sheet__title" style={{ fontSize: 13, marginBottom: 2 }}>
          Escalation
        </h3>
        <p className="kds-sheet__hint" style={{ marginBottom: 10 }}>
          Minutes since payment. A ticket's rule thickens and its timer gains weight as it crosses each
          step; no colour is used to carry the message.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          <label className="kds-field" htmlFor="kds-threshold-attention">
            <span className="kds-field__label">Watch</span>
            <input
              id="kds-threshold-attention"
              className="kds-field__input"
              type="number"
              min={1}
              max={240}
              value={draft.thresholds.attention}
              onChange={(event) => patch({ thresholds: { attention: Number(event.target.value) } })}
            />
          </label>
          <label className="kds-field" htmlFor="kds-threshold-over">
            <span className="kds-field__label">Over</span>
            <input
              id="kds-threshold-over"
              className="kds-field__input"
              type="number"
              min={2}
              max={240}
              value={draft.thresholds.over}
              onChange={(event) => patch({ thresholds: { over: Number(event.target.value) } })}
            />
          </label>
          <label className="kds-field" htmlFor="kds-threshold-well-over">
            <span className="kds-field__label">Well over</span>
            <input
              id="kds-threshold-well-over"
              className="kds-field__input"
              type="number"
              min={3}
              max={240}
              value={draft.thresholds.wellOver}
              onChange={(event) => patch({ thresholds: { wellOver: Number(event.target.value) } })}
            />
          </label>
        </div>

        <label className="kds-field" htmlFor="kds-ready-hold">
          <span className="kds-field__label">Ready column holds tickets for</span>
          <input
            id="kds-ready-hold"
            className="kds-field__input"
            type="number"
            min={2}
            max={120}
            value={draft.readyHoldMinutes}
            onChange={(event) => patch({ readyHoldMinutes: Number(event.target.value) })}
          />
          <span className="kds-field__hint">
            Minutes. After that a ready ticket moves to Recently ready, where it can still be recalled.
          </span>
        </label>

        <div className="kds-toggle-row">
          <span>
            Large type
            <span className="kds-toggle-row__hint">Scales every ticket for a screen across the room.</span>
          </span>
          <Toggle
            id="kds-big-type"
            label="Large type"
            checked={draft.bigType}
            onChange={(next) => patch({ bigType: next })}
          />
        </div>

        <div className="kds-toggle-row">
          <span>
            Appearance
            <span className="kds-toggle-row__hint">Auto follows the tablet's light or dark setting.</span>
          </span>
          <div className="kds-seg" role="group" aria-label="Appearance">
            {THEMES.map((theme) => (
              <button
                key={theme.key}
                type="button"
                aria-pressed={draft.theme === theme.key}
                onClick={() => patch({ theme: theme.key })}
              >
                {theme.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <button
            type="button"
            className="kds-btn"
            onClick={() => {
              const defaults = normaliseKitchenSettings({
                ...DEFAULT_KITCHEN_SETTINGS,
                sound: draft.sound,
                volume: draft.volume,
              });
              setDraft(defaults);
              onChange(defaults);
            }}
          >
            Reset thresholds
          </button>
        </div>
      </aside>
    </>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ExternalLink,
  Maximize2,
  Minimize2,
  RefreshCw,
  Settings2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { toast } from '@/components/dashboard';
import { KitchenTicket } from './ticket-card';
import { RecentlyReady } from './recently-ready';
import { KitchenSettingsSheet } from './kitchen-settings';
import { KitchenPrintTicket } from './kitchen-print-ticket';
import {
  loadKitchenSettings,
  saveKitchenSettings,
  type KitchenDeviceSettings,
} from '@/lib/kitchen/device-settings';
import { kitchenAudioSupported, playKitchenAlert, primeKitchenAudio } from '@/lib/kitchen/sound';
import type { KitchenBoardPayload, KitchenOrder, KitchenStage } from '@/lib/kitchen/types';
import { money } from '@/components/dashboard/tokens';

/**
 * The kitchen board.
 *
 * Design decisions worth knowing before changing anything here:
 *
 * - **One clock.** Every ticket's elapsed time is computed from one `now` state
 *   that ticks once a second. Ten tickets re-rendering from ten timers is how a
 *   tablet starts to stutter at 19:30.
 * - **Polling that knows when nobody is looking.** 5 s while the tab is visible,
 *   nothing while hidden, an immediate forced refresh the moment it comes back.
 *   `If-None-Match` makes an empty poll a 304 with no body.
 * - **Sound never guesses.** The alert only ever fires for an order whose payment
 *   timestamp is real, it repeats every 30 s while a New ticket is untouched, and
 *   it can be silenced from a bar the cook can always see.
 * - **Nothing is red or green.** Escalation is a left rule that thickens, a timer
 *   that gains weight and a written flag: On time, Watch, Over target, Well over.
 */

const POLL_MS = 5000;
const REPEAT_ALERT_MS = 30000;
const FIRST_LOAD_ALERT_WINDOW_MS = 60_000;
const GATE_KEY = 'foodbase.kitchen.sound-gate.v1';

const COLUMNS: { stage: KitchenStage; title: string; hint: string; empty: string }[] = [
  {
    stage: 'new',
    title: 'New',
    hint: 'Oldest first',
    empty: 'No paid orders are waiting. A paid order appears here within five seconds.',
  },
  { stage: 'preparing', title: 'Preparing', hint: 'Oldest first', empty: 'Nothing on the line.' },
  { stage: 'ready', title: 'Ready', hint: 'Waiting to be collected', empty: 'Nothing on the pass.' },
];

type ConnectionState = 'live' | 'paused' | 'retrying' | 'offline';

const CONNECTION_LABEL: Record<ConnectionState, string> = {
  live: 'Live · every 5s',
  paused: 'Paused while hidden',
  retrying: 'Reconnecting',
  offline: 'Offline · retrying',
};

function averageLabel(seconds: number | null): string {
  if (seconds === null) return '—';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest}s`;
  return `${minutes}m ${String(rest).padStart(2, '0')}s`;
}

export function KitchenBoard({ businessName }: { businessName: string }) {
  const [payload, setPayload] = useState<KitchenBoardPayload | null>(null);
  const [error, setError] = useState('');
  const [connection, setConnection] = useState<ConnectionState>('retrying');
  const [now, setNow] = useState(() => Date.now());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [settings, setSettings] = useState<KitchenDeviceSettings>(() => loadKitchenSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [printOrder, setPrintOrder] = useState<KitchenOrder | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [repeatMuted, setRepeatMuted] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const etagRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const ordersRef = useRef<KitchenOrder[]>([]);
  const settingsRef = useRef(settings);
  const alertedRef = useRef<Set<string>>(new Set());
  const seededRef = useRef(false);
  const readySeenRef = useRef<Map<string, number>>(new Map());
  const repeatMutedRef = useRef(false);
  const audioReadyRef = useRef(false);

  useEffect(() => {
    settingsRef.current = settings;
    saveKitchenSettings(settings);
  }, [settings]);

  useEffect(() => {
    repeatMutedRef.current = repeatMuted;
  }, [repeatMuted]);

  useEffect(() => {
    audioReadyRef.current = audioReady;
  }, [audioReady]);

  /* ------------------------------ the fetch ------------------------------- */

  const poll = useCallback(async (force = false) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const headers: Record<string, string> = {};
      if (!force && etagRef.current) headers['If-None-Match'] = etagRef.current;
      const response = await fetch('/api/business/kitchen/orders', {
        headers,
        cache: 'no-store',
        credentials: 'include',
      });

      if (response.status === 304) {
        setConnection(document.visibilityState === 'visible' ? 'live' : 'paused');
        setLastSync(new Date());
        setError('');
        return;
      }

      if (response.status === 401) {
        setConnection('offline');
        setError('This session has expired. Sign in again to keep the kitchen board live.');
        return;
      }

      if (!response.ok) {
        setConnection('retrying');
        setError('The board could not refresh. It will try again in five seconds.');
        return;
      }

      const data = (await response.json()) as KitchenBoardPayload;
      const etag = response.headers.get('etag') ?? (data.etag ? `"${data.etag}"` : null);
      if (etag) etagRef.current = etag;

      setPayload(data);
      setError('');
      setConnection(document.visibilityState === 'visible' ? 'live' : 'paused');
      setLastSync(new Date());
    } catch {
      setConnection('offline');
      setError('The connection dropped. The board keeps the last tickets it saw and retries every five seconds.');
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  // First load, then a 5 s poll that stops the moment the tab is hidden.
  useEffect(() => {
    void poll(true);
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => void poll(), POLL_MS);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void poll(true); // immediate refresh on return, bypassing the ETag
        start();
      } else {
        stop();
        setConnection('paused');
      }
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [poll]);

  // One clock for every ticket.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    ordersRef.current = payload?.orders ?? [];
  }, [payload]);

  /* ------------------------------- the sound ------------------------------ */

  const play = useCallback((urgency: 'new' | 'repeat' | 'test') => {
    playKitchenAlert({ urgency, volume: settingsRef.current.volume });
  }, []);

  // React to new paid orders.
  useEffect(() => {
    const orders = payload?.orders;
    if (!orders) return;
    const fresh = orders.filter((order) => order.stage === 'new' && !alertedRef.current.has(order.id));
    for (const order of fresh) alertedRef.current.add(order.id);

    if (fresh.length > 0) setRepeatMuted(false); // a real arrival re-arms the repeat

    const shouldPlay =
      settingsRef.current.sound && audioReadyRef.current && !repeatMutedRef.current && fresh.length > 0;
    if (!shouldPlay) {
      seededRef.current = true;
      return;
    }

    if (!seededRef.current) {
      seededRef.current = true;
      // A reload during service must not scream about the four tickets already on
      // the board, but it should still catch one that arrived a moment ago.
      const cutoff = Date.now() - FIRST_LOAD_ALERT_WINDOW_MS;
      const recent = fresh.some((order) => new Date(order.paidAt).getTime() >= cutoff);
      if (recent) play('new');
      return;
    }

    play('new');
  }, [payload, play]);

  // The repeat, every 30 s, while at least one New ticket is untouched.
  useEffect(() => {
    const timer = setInterval(() => {
      const hasUntouched = ordersRef.current.some((order) => order.stage === 'new');
      if (!hasUntouched) return;
      if (!settingsRef.current.sound || !audioReadyRef.current) return;
      if (repeatMutedRef.current) return;
      play('repeat');
    }, REPEAT_ALERT_MS);
    return () => clearInterval(timer);
  }, [play]);

  // The first-run gate only appears where sound is possible and still expected.
  useEffect(() => {
    const supported = kitchenAudioSupported();
    if (!supported) return;
    let acknowledged = false;
    try {
      acknowledged = window.localStorage.getItem(GATE_KEY) === '1';
    } catch {
      acknowledged = false;
    }
    if (!acknowledged && settings.sound) setGateOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acknowledgeGate = useCallback((enabled: boolean) => {
    try {
      window.localStorage.setItem(GATE_KEY, '1');
    } catch {
      // Private mode: the gate simply reappears next time.
    }
    setGateOpen(false);
    setSettings((current) => ({ ...current, sound: enabled }));
  }, []);

  const enableSound = useCallback(async () => {
    const ready = await primeKitchenAudio();
    setAudioReady(ready);
    if (!ready) {
      toast.error('This browser would not start audio', {
        description: 'Check the tablet is not on silent and try again.',
      });
      return;
    }
    playKitchenAlert({ urgency: 'test', volume: settingsRef.current.volume });
    acknowledgeGate(true);
  }, [acknowledgeGate]);

  const testSound = useCallback(async () => {
    const ready = audioReady || (await primeKitchenAudio());
    setAudioReady(ready);
    playKitchenAlert({ urgency: 'test', volume: settingsRef.current.volume });
  }, [audioReady]);

  // If the gate was dismissed earlier, the first tap anywhere unlocks audio.
  useEffect(() => {
    if (audioReady) return;
    const unlock = async () => {
      const ready = await primeKitchenAudio();
      if (ready) setAudioReady(true);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, [audioReady]);

  /* ------------------------------- wake lock ------------------------------ */

  useEffect(() => {
    let sentinel: { release?: () => Promise<void> } | null = null;
    let cancelled = false;
    const wakeLock = (navigator as unknown as { wakeLock?: { request: (type: string) => Promise<any> } }).wakeLock;

    const acquire = async () => {
      if (!wakeLock || cancelled) return;
      try {
        sentinel = await wakeLock.request('screen');
      } catch {
        // Some browsers refuse without a visible document; the screen simply sleeps.
      }
    };

    void acquire();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release?.();
    };
  }, []);

  /* ------------------------------ full screen ----------------------------- */

  useEffect(() => {
    const onChange = () => setIsFullScreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullScreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast.error('Full screen was refused', {
        description: 'Use the browser menu to hide its toolbar instead.',
      });
    }
  }, []);

  /* ------------------------------- printing ------------------------------- */

  const print = useCallback((order: KitchenOrder) => {
    setPrintOrder(order);
    // Let React paint the ticket before the print dialog snapshots the page.
    window.setTimeout(() => window.print(), 80);
  }, []);

  useEffect(() => {
    const clear = () => setPrintOrder(null);
    window.addEventListener('afterprint', clear);
    return () => window.removeEventListener('afterprint', clear);
  }, []);

  /* ------------------------------ transitions ----------------------------- */

  const advance = useCallback(
    async (order: KitchenOrder, to: KitchenStage, prepMinutes?: number) => {
      setBusyId(order.id);
      setPayload((current) =>
        current
          ? { ...current, orders: current.orders.map((row) => (row.id === order.id ? { ...row, stage: to } : row)) }
          : current,
      );
      try {
        const response = await fetch(`/api/business/kitchen/orders/${order.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ to, ...(prepMinutes ? { prepMinutes } : {}) }),
        });
        if (!response.ok) {
          const detail = (await response.json().catch(() => ({}))) as { error?: string };
          toast.error(detail.error ?? 'That ticket could not be moved.', {
            description: `#${order.shortId} is unchanged.`,
          });
        }
      } catch {
        toast.error('The dashboard could not be reached', {
          description: `#${order.shortId} is unchanged. The board will catch up on its own.`,
        });
      } finally {
        setBusyId(null);
        await poll(true);
      }
    },
    [poll],
  );

  /* -------------------------------- derived ------------------------------- */

  const orders = payload?.orders ?? [];

  const { onPass, recalled } = useMemo(() => {
    const holdMs = Math.max(1, settings.readyHoldMinutes) * 60_000;
    const ready = orders.filter((order) => order.stage === 'ready');
    const seen = readySeenRef.current;

    // Fall back to when this device first saw the ticket, so the roll-over works
    // whether or not the 3C `kitchen_ready_at` column exists.
    for (const order of ready) {
      if (!seen.has(order.id)) seen.set(order.id, Date.now());
    }
    for (const key of Array.from(seen.keys())) {
      if (!ready.some((order) => order.id === key)) seen.delete(key);
    }

    const ageOf = (order: KitchenOrder) => {
      const readyAt = order.readyAt ? new Date(order.readyAt).getTime() : seen.get(order.id) ?? Date.now();
      return Math.max(0, now - readyAt);
    };

    const onPassList = ready.filter((order) => ageOf(order) < holdMs).sort((a, b) => ageOf(b) - ageOf(a));
    const recalledList = ready.filter((order) => ageOf(order) >= holdMs).sort((a, b) => ageOf(a) - ageOf(b));
    return { onPass: onPassList, recalled: recalledList };
  }, [orders, settings.readyHoldMinutes, now]);

  const byStage = useMemo(() => {
    const newestFirst = (list: KitchenOrder[]) =>
      [...list].sort((a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime());
    return {
      new: newestFirst(orders.filter((order) => order.stage === 'new')),
      preparing: newestFirst(orders.filter((order) => order.stage === 'preparing')),
      ready: onPass,
    } as Record<KitchenStage, KitchenOrder[]>;
  }, [orders, onPass]);

  const openNew = byStage.new.length;
  const alertBarVisible = openNew > 0 && settings.sound && !repeatMuted;

  /* --------------------------------- render ------------------------------- */

  return (
    <div
      className="dash-surface kds-shell"
      data-kds-theme={settings.theme}
      data-kds-type={settings.bigType ? 'large' : 'normal'}
    >
      <header className="kds-top">
        <div className="kds-top__id">
          <span className="kds-top__eyebrow">Kitchen</span>
          <span className="kds-top__name">{businessName}</span>
          <span className="kds-conn" data-state={connection} aria-live="polite">
            <span className="kds-conn__dot" aria-hidden="true" />
            {CONNECTION_LABEL[connection]}
            {lastSync ? ` · ${lastSync.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
          </span>
        </div>

        <div className="kds-toolbar">
          <button
            type="button"
            className="kds-btn"
            aria-pressed={settings.sound}
            onClick={() => {
              const next = !settings.sound;
              setSettings((current) => ({ ...current, sound: next }));
              if (next) {
                void primeKitchenAudio().then(setAudioReady);
                play('test');
              }
            }}
          >
            {settings.sound ? <Volume2 className="size-4" aria-hidden="true" /> : <VolumeX className="size-4" aria-hidden="true" />}
            {settings.sound ? 'Sound on' : 'Sound off'}
          </button>
          <button type="button" className="kds-btn" onClick={testSound}>
            Test
          </button>
          <button type="button" className="kds-btn kds-btn--icon" onClick={toggleFullScreen} aria-label={isFullScreen ? 'Leave full screen' : 'Go full screen'}>
            {isFullScreen ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="kds-btn kds-btn--icon"
            onClick={() => setSettingsOpen(true)}
            aria-label="Kitchen display settings"
          >
            <Settings2 className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="kds-btn kds-btn--icon"
            onClick={() => void poll(true)}
            aria-label="Refresh the board now"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </button>
          <Link href="/dashboard/orders" className="kds-btn">
            <ExternalLink className="size-4" aria-hidden="true" />
            Orders
          </Link>
        </div>
      </header>

      <div className="kds-stats">
        <div className="kds-stat">
          <span className="kds-stat__label">Paid today</span>
          <span className="kds-stat__value">{payload?.stats.paidToday ?? '—'}</span>
        </div>
        <div className="kds-stat">
          <span className="kds-stat__label">Reached the pass</span>
          <span className="kds-stat__value">{payload?.stats.readyToday ?? '—'}</span>
        </div>
        <div className="kds-stat">
          <span className="kds-stat__label">Average to ready</span>
          <span className="kds-stat__value">{averageLabel(payload?.stats.averagePrepSeconds ?? null)}</span>
        </div>
        <div className="kds-stat">
          <span className="kds-stat__label">Oldest open ticket</span>
          <span className="kds-stat__value">{averageLabel(payload?.stats.oldestOpenSeconds ?? null)}</span>
        </div>
        <div className="kds-stat" style={{ marginLeft: 'auto', borderRight: 0 }}>
          <span className="kds-stat__label">Open tickets</span>
          <span className="kds-stat__value">
            {byStage.new.length + byStage.preparing.length + byStage.ready.length}
          </span>
        </div>
      </div>

      {alertBarVisible ? (
        <div className="kds-alert-bar" role="status">
          <span>
            {openNew} {openNew === 1 ? 'paid order is' : 'paid orders are'} waiting to be started. The alert
            repeats every 30 seconds.
          </span>
          <button
            type="button"
            className="kds-btn"
            onClick={() => {
              setRepeatMuted(true);
              toast.success('Alerts stopped', {
                description: 'The next new paid order will sound again.',
              });
            }}
          >
            Stop alerts
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="kds-alert-bar" role="alert">
          <span>{error}</span>
          <button type="button" className="kds-btn" onClick={() => void poll(true)}>
            Try again
          </button>
        </div>
      ) : null}

      <main className="kds-board">
        <div className="kds-columns">
          {COLUMNS.map((column) => {
            const tickets = byStage[column.stage];
            return (
              <section
                key={column.stage}
                className="kds-column"
                aria-labelledby={`kds-col-${column.stage}`}
              >
                <div className="kds-column__head">
                  <span className="kds-column__name" id={`kds-col-${column.stage}`}>
                    {column.title}
                    <span className="kds-column__count">{tickets.length}</span>
                  </span>
                  <span className="kds-column__hint">{column.hint}</span>
                </div>
                <div className="kds-column__body">
                  {!payload && !error
                    ? Array.from({ length: column.stage === 'new' ? 2 : 1 }).map((_, index) => (
                        <div key={index} className="kds-skeleton" aria-hidden="true" />
                      ))
                    : null}

                  {payload && tickets.length === 0 ? (
                    <p className="kds-empty">{column.empty}</p>
                  ) : null}

                  {tickets.map((order) => (
                    <KitchenTicket
                      key={order.id}
                      order={order}
                      now={now}
                      thresholds={settings.thresholds}
                      busy={busyId === order.id}
                      onAdvance={advance}
                      onPrint={print}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>

      <RecentlyReady
        orders={recalled}
        now={now}
        open={drawerOpen}
        busyId={busyId}
        onToggle={() => setDrawerOpen((open) => !open)}
        onRecall={(order) => void advance(order, 'preparing')}
        onPrint={print}
      />

      {gateOpen ? (
        <div className="kds-scrim" role="dialog" aria-modal="true" aria-labelledby="kds-gate-title">
          <div className="kds-gate">
            <h2 className="kds-gate__title" id="kds-gate-title">
              Sound for this pass
            </h2>
            <p className="kds-gate__copy">
              A paid order should be heard, not only seen. Browsers will not play audio until someone taps
              once, so start the sound here. The board works either way.
            </p>
            <div className="kds-gate__actions">
              <button type="button" className="kds-gate__primary" onClick={() => void enableSound()}>
                Enable sound
              </button>
              <button type="button" className="kds-gate__secondary" onClick={() => acknowledgeGate(false)}>
                Continue without sound
              </button>
            </div>
            <p className="kds-gate__note">
              Volume and the escalation thresholds are set per device in Settings. Sound can be muted at any
              time from the top bar.
            </p>
          </div>
        </div>
      ) : null}

      {settingsOpen ? (
        <KitchenSettingsSheet
          settings={settings}
          soundSupported={kitchenAudioSupported()}
          onChange={setSettings}
          onClose={() => setSettingsOpen(false)}
          onTestSound={() => void testSound()}
        />
      ) : null}

      {printOrder ? (
        <KitchenPrintTicket order={printOrder} businessName={businessName} printedAt={new Date()} />
      ) : null}

      <p className="sr-only" aria-live="polite">
        {payload
          ? `${byStage.new.length} new, ${byStage.preparing.length} preparing, ${byStage.ready.length} ready. ${money(
              orders.reduce((sum, order) => sum + order.total, 0),
            )} on the board.`
          : 'Loading the kitchen board.'}
      </p>
    </div>
  );
}

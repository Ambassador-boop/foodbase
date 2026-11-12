'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BellRing, Loader2, Volume2 } from 'lucide-react';
import { SectionCard, Toggle, toast } from '@/components/dashboard';
import { loadKitchenSettings, saveKitchenSettings, type KitchenDeviceSettings } from '@/lib/kitchen/device-settings';
import { playKitchenAlert, primeKitchenAudio } from '@/lib/kitchen/sound';
import { isMedianEnvironment, requestPushPermission, initializeOneSignalFlow } from '@/lib/median-bridge';

/**
 * Notification settings (Batch 3C, item b5).
 *
 * Three questions this screen answers honestly, in this order:
 *   1. Is push configured for the restaurant at all? (server truth)
 *   2. Is *this* device registered? (browser truth: permission + subscription id)
 *   3. Can it be heard? (device settings for the alert tone)
 *
 * "Send test notification" is a real send through the same OneSignal path a paid
 * order takes. If it is accepted but reaches no device, the screen says that
 * rather than reporting success.
 */

type Permission = 'default' | 'granted' | 'denied' | 'unsupported';
type Environment = 'checking' | 'web' | 'median' | 'unsupported';

type ServerStatus = {
  configured: boolean;
  sound: {
    configured: boolean;
    iosSound: string | null;
    androidChannelId: string | null;
    interruptionLevel: string | null;
    bundledFileHint: string;
    androidNote: string;
    iosNote: string;
  };
  business: { id: string; name: string };
};

function oneSignalSdk(timeoutMs = 4000): Promise<any | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(null);
    const w = window as any;
    if (w.OneSignal && w.OneSignal.User) return resolve(w.OneSignal);
    w.OneSignalDeferred = w.OneSignalDeferred || [];
    let settled = false;
    w.OneSignalDeferred.push((sdk: any) => {
      if (!settled) {
        settled = true;
        resolve(sdk);
      }
    });
    window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);
  });
}

function Row({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-[var(--dash-line)] py-2.5 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--dash-ink-4)]">{label}</dt>
      <dd className="min-w-0 text-[13px] text-[var(--dash-ink-1)] sm:text-right">
        {value}
        {hint ? <span className="mt-0.5 block text-[11.5px] text-[var(--dash-ink-3)]">{hint}</span> : null}
      </dd>
    </div>
  );
}

export function NotificationSettingsPanel() {
  const [environment, setEnvironment] = useState<Environment>('checking');
  const [permission, setPermission] = useState<Permission>('default');
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [settings, setSettings] = useState<KitchenDeviceSettings>(() => loadKitchenSettings());
  const [busy, setBusy] = useState<'register' | 'test' | null>(null);
  const [testLine, setTestLine] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const median = isMedianEnvironment();
    if (median) {
      setEnvironment('median');
      setPermission('default');
    } else if (typeof window !== 'undefined' && typeof Notification !== 'undefined') {
      setEnvironment('web');
      setPermission(Notification.permission as Permission);
    } else {
      setEnvironment('unsupported');
      setPermission('unsupported');
    }

    let active = true;
    fetch('/api/business/notifications/test', { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active && data) setStatus(data as ServerStatus);
      })
      .catch(() => undefined);

    fetch('/api/user/profile', { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active && data?.user?.email) setEmail(String(data.user.email));
      })
      .catch(() => undefined);

    if (!median) {
      void oneSignalSdk().then((sdk) => {
        if (!active || !sdk) return;
        const id = sdk?.User?.PushSubscription?.id ?? null;
        if (id) setSubscriptionId(String(id));
      });
    }

    return () => {
      active = false;
    };
  }, []);

  const update = useCallback((next: Partial<KitchenDeviceSettings>) => {
    const merged = saveKitchenSettings({ ...settings, ...next });
    setSettings(merged);
  }, [settings]);

  const register = useCallback(async () => {
    setBusy('register');
    setTestLine(null);
    try {
      if (environment === 'median') {
        const granted = await requestPushPermission();
        setPermission(granted ? 'granted' : 'denied');
        if (!granted) {
          setTestLine({ tone: 'error', text: 'The app was not allowed to send notifications for this device.' });
          return;
        }
        const id = email ? await initializeOneSignalFlow(email) : null;
        if (id) {
          setSubscriptionId(id);
          toast.success('This device is registered');
        } else {
          setTestLine({ tone: 'error', text: 'The app could not register this device. Reopen the app and try again.' });
        }
        return;
      }

      const sdk = await oneSignalSdk(8000);
      if (!sdk) {
        setTestLine({
          tone: 'error',
          text: 'The notification service is still loading. Wait a moment and tap again.',
        });
        return;
      }
      const granted = await sdk.Notifications.requestPermission();
      const state = String(sdk.Notifications.permission ?? '');
      setPermission(state === 'granted' ? 'granted' : state === 'denied' ? 'denied' : 'default');
      if (!granted) {
        setTestLine({
          tone: 'error',
          text: 'This browser is blocking notifications. Allow them for this site, then register again.',
        });
        return;
      }

      if (status?.business?.id) {
        await sdk.User.addTags({ business_id: status.business.id, role: 'owner' });
      }
      const id = sdk?.User?.PushSubscription?.id ?? null;
      if (id) setSubscriptionId(String(id));

      if (id && email) {
        await fetch('/api/save-push-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ oneSignalUserId: id, externalId: email, email }),
        });
      }
      toast.success('This device is registered', {
        description: 'Paid orders will alert it even when the dashboard is closed.',
      });
    } catch (error) {
      console.error('[notifications] registration failed', error);
      setTestLine({ tone: 'error', text: 'Registration did not complete. Try again.' });
    } finally {
      setBusy(null);
    }
  }, [email, environment, status?.business?.id]);

  const sendTest = useCallback(async () => {
    setBusy('test');
    setTestLine(null);
    try {
      const response = await fetch('/api/business/notifications/test', {
        method: 'POST',
        credentials: 'include',
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        recipients?: number | null;
        deliveredToDevice?: boolean | null;
      };
      if (!response.ok) {
        setTestLine({ tone: 'error', text: data.error ?? 'The test could not be sent.' });
        return;
      }
      if (data.deliveredToDevice === false) {
        setTestLine({
          tone: 'warn',
          text: 'OneSignal accepted the test but no device is tagged for this restaurant yet. Register this device first.',
        });
        return;
      }
      const count = typeof data.recipients === 'number' ? data.recipients : null;
      setTestLine({
        tone: 'ok',
        text: count === null ? 'Test sent.' : `Test sent to ${count} ${count === 1 ? 'device' : 'devices'}.`,
      });
    } catch {
      setTestLine({ tone: 'error', text: 'The test could not be sent. Check the connection and try again.' });
    } finally {
      setBusy(null);
    }
  }, []);

  const permissionLabel =
    permission === 'granted'
      ? 'Allowed'
      : permission === 'denied'
        ? 'Blocked in this browser'
        : permission === 'unsupported'
          ? 'Not supported here'
          : 'Not asked yet';

  const toneClasses =
    testLine?.tone === 'ok'
      ? 'border-[var(--dash-success)]/40 bg-[var(--dash-success-bg)] text-[var(--dash-success)]'
      : testLine?.tone === 'warn'
        ? 'border-[var(--dash-warning)]/40 bg-[var(--dash-warning-bg)] text-[var(--dash-warning)]'
        : 'border-[var(--dash-danger)]/40 bg-[var(--dash-danger-bg)] text-[var(--dash-danger)]';

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <SectionCard
        title="This device"
        description="Push registration and the alert sound. Both are per device."
      >
        <dl className="m-0">
          <Row
            label="Push service"
            value={
              status === null
                ? 'Checking…'
                : status.configured
                  ? 'Configured'
                  : 'Not configured on this deployment'
            }
            hint={
              status && !status.configured
                ? 'Set NEXT_PUBLIC_ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY to send alerts.'
                : undefined
            }
          />
          <Row
            label="Device"
            value={
              environment === 'median'
                ? 'Median app'
                : environment === 'web'
                  ? 'Web browser'
                  : environment === 'unsupported'
                    ? 'No notification support'
                    : 'Checking…'
            }
          />
          <Row label="Permission" value={permissionLabel} />
          <Row
            label="Registered for push"
            value={subscriptionId ? `Registered · …${subscriptionId.slice(-6)}` : 'Not registered on this device'}
            hint={
              subscriptionId
                ? 'Paid orders will alert this device even when the dashboard is closed.'
                : 'Register to get paid-order alerts when the dashboard is not open.'
            }
          />

          <div className="flex items-center justify-between gap-4 border-b border-[var(--dash-line)] py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--dash-ink-4)]">
              Alert sound
            </dt>
            <dd className="m-0 flex items-center gap-3">
              <span className="text-[12px] text-[var(--dash-ink-3)]">{Math.round(settings.volume * 100)}%</span>
              <Toggle
                id="notif-sound"
                label="Alert sound"
                checked={settings.sound}
                onChange={(next) => {
                  update({ sound: next });
                  if (next) {
                    void primeKitchenAudio().then((ready) => {
                      if (ready) playKitchenAlert({ urgency: 'test', volume: settings.volume });
                    });
                  }
                }}
              />
            </dd>
          </div>

          <div className="border-b border-[var(--dash-line)] py-3">
            <label
              htmlFor="notif-volume"
              className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--dash-ink-4)]"
            >
              Volume
            </label>
            <input
              id="notif-volume"
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(settings.volume * 100)}
              onChange={(event) => update({ volume: Number(event.target.value) / 100 })}
              className="w-full accent-[var(--dash-brown)]"
              aria-valuetext={`${Math.round(settings.volume * 100)} percent`}
            />
            <p className="mt-1 text-[11.5px] leading-[1.5] text-[var(--dash-ink-3)]">
              The same setting the kitchen display uses on this device.
            </p>
          </div>

          <Row
            label="Native push sound"
            value={
              status?.sound.configured
                ? [status.sound.iosSound ? `iOS ${status.sound.iosSound}` : null, status.sound.androidChannelId ? 'Android channel set' : null]
                    .filter(Boolean)
                    .join(' · ')
                : 'Not set — the phone uses its default notification sound'
            }
            hint={
              status?.sound.configured
                ? 'Native sounds only play inside the Median app build; a browser tab always uses the system sound.'
                : 'See docs/BATCH_3C_REPORT.md for the OneSignal and Median steps.'
            }
          />
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void register()}
            disabled={busy !== null || environment === 'unsupported'}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--dash-brown)] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--dash-brown-deep)] disabled:opacity-55"
          >
            {busy === 'register' ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {subscriptionId ? 'Register again' : 'Register this device'}
          </button>
          <button
            type="button"
            onClick={() => void sendTest()}
            disabled={busy !== null || status?.configured === false}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-[var(--dash-line-strong)] bg-[var(--dash-surface)] px-4 text-[13px] font-medium text-[var(--dash-ink-2)] transition-colors hover:bg-[var(--dash-surface-inset)] disabled:opacity-55"
          >
            {busy === 'test' ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <BellRing className="size-4" aria-hidden="true" />}
            Send test notification
          </button>
        </div>

        {testLine ? (
          <p role="status" className={`mt-3 rounded-lg border px-3 py-2 text-[12.5px] leading-[1.5] ${toneClasses}`}>
            {testLine.text}
          </p>
        ) : null}
      </SectionCard>

      <div className="grid gap-4">
        <SectionCard title="What gets sent, and when" padding="tight">
          <ul className="m-0 list-none space-y-2.5 p-0 text-[12.5px] leading-[1.55] text-[var(--dash-ink-3)]">
            <li>
              <span className="font-semibold text-[var(--dash-ink-1)]">Paid order</span> — once, the moment
              payment clears. Short id, total, item count and the table when there is one.
            </li>
            <li>
              <span className="font-semibold text-[var(--dash-ink-1)]">Status change</span> — when an order is
              moved on the orders page, as it always has been.
            </li>
            <li>
              <span className="font-semibold text-[var(--dash-ink-1)]">Unpaid orders</span> — never. An order
              that has not paid is not announced.
            </li>
          </ul>
        </SectionCard>

        <SectionCard title="Hearing it in the kitchen" padding="tight">
          <p className="m-0 text-[12.5px] leading-[1.55] text-[var(--dash-ink-3)]">
            The kitchen display has its own start screen that unlocks sound with one tap, its own volume, and
            an alert that repeats every 30 seconds while a new paid order sits untouched.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/kitchen"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--dash-line-strong)] px-3 text-[12.5px] font-medium text-[var(--dash-ink-2)] hover:bg-[var(--dash-surface-inset)]"
            >
              <Volume2 className="size-4" aria-hidden="true" />
              Open the kitchen display
            </Link>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

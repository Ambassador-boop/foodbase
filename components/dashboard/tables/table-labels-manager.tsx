'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Printer,
  Plus,
  Table2,
  Trash2,
  X,
} from 'lucide-react';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormField,
  Notice,
  PageSkeleton,
  SectionCard,
  StatGrid,
  StatTile,
  TextInput,
  Toggle,
  toast,
} from '@/components/dashboard';
import type { TableLabel } from '@/lib/delivery/types';

/**
 * Table labels (Batch 3B).
 *
 * A dine-in order needs one fact the current order flow cannot infer: which
 * table. This screen creates the labels a customer picks from, and prints the
 * table cards that put a QR code on the table in the first place.
 *
 * QR links point at `/{slug}?table=<label>`. The storefront stores the label
 * against the cart and checkout preselects it, but the value is only ever a
 * preselection: the order API validates it against the active labels.
 */

const MAX_LABEL_LENGTH = 24;

type LabelsResponse = {
  configured: boolean;
  labels: TableLabel[];
  business: { id: string; name: string; slug: string };
};

export function TableLabelsManager() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<LabelsResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [prefix, setPrefix] = useState('Table');
  const [start, setStart] = useState('1');
  const [count, setCount] = useState('12');
  const [custom, setCustom] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<TableLabel | null>(null);
  const [origin, setOrigin] = useState('');
  const [showSheet, setShowSheet] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const response = await fetch('/api/business/table-labels');
      if (!response.ok) throw new Error('failed');
      const payload: LabelsResponse = await response.json();
      setData(payload);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // The QR target needs the real host; computed after mount to avoid a
  // server/client mismatch in the printed link.
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const labels = data?.labels ?? [];
  const active = labels.filter((label) => label.is_active);
  const schemaReady = data?.configured ?? false;

  const tableUrl = useCallback(
    (label: string) =>
      `${origin}/${data?.business.slug ?? ''}?table=${encodeURIComponent(label)}`,
    [origin, data?.business.slug],
  );

  const post = async (body: Record<string, unknown>, successMessage: string) => {
    setBusy(true);
    try {
      const response = await fetch('/api/business/table-labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result?.error || 'Could not create those labels.');
        return false;
      }
      toast.success(successMessage);
      await load();
      return true;
    } catch {
      toast.error('Could not create those labels.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const createSequence = async () => {
    const numericCount = Number(count);
    if (!Number.isFinite(numericCount) || numericCount < 1) {
      toast.error('Choose how many tables to create.');
      return;
    }
    const created = await post(
      { mode: 'sequence', prefix, start: Number(start) || 1, count: numericCount },
      `${numericCount} labels created.`,
    );
    if (created) setCount('0');
  };

  const createCustom = async () => {
    const label = custom.trim();
    if (!label) {
      toast.error('Enter a table name.');
      return;
    }
    const created = await post({ mode: 'single', label }, `"${label}" added.`);
    if (created) setCustom('');
  };

  const patchLabel = async (id: string, body: Record<string, unknown>, message: string) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/business/table-labels/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result?.error || 'Could not save this label.');
        return false;
      }
      toast.success(message);
      await load();
      return true;
    } catch {
      toast.error('Could not save this label.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const removeLabel = async () => {
    if (!confirmRemove) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/business/table-labels/${confirmRemove.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const result = await response.json();
        toast.error(result?.error || 'Could not remove this label.');
        return;
      }
      toast.success('Label removed.');
      setConfirmRemove(null);
      await load();
    } catch {
      toast.error('Could not remove this label.');
    } finally {
      setBusy(false);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= labels.length) return;
    const next = [...labels];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setBusy(true);
    try {
      const response = await fetch('/api/business/table-labels', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: next.map((label) => label.id) }),
      });
      if (!response.ok) {
        const result = await response.json();
        toast.error(result?.error || 'Could not save the new order.');
        return;
      }
      setData((current) => (current ? { ...current, labels: next.map((label, i) => ({ ...label, sort_order: i + 1 })) } : current));
    } catch {
      toast.error('Could not save the new order.');
    } finally {
      setBusy(false);
    }
  };

  const sheetLabels = useMemo(() => active, [active]);

  if (status === 'loading') {
    return <PageSkeleton />;
  }

  if (status === 'error' || !data) {
    return (
      <ErrorState
        title="Table labels could not load"
        description="This is a connection problem on our side. Your existing labels have not been touched."
        onRetry={() => void load()}
        retryLabel="Try again"
      />
    );
  }

  return (
    <>
      {!schemaReady && (
        <div className="mb-5">
          <Notice tone="warning" title="One database step is still pending">
            Table labels need a new table in your database before they can be saved. Run the Batch 3B
            migration, then reload this page. Dine-in ordering works exactly as it does today until
            then.
          </Notice>
        </div>
      )}

      <StatGrid>
        <StatTile
          label="Labels"
          value={labels.length}
          unit={labels.length === 1 ? 'label' : 'labels'}
          hint={labels.length > active.length ? `${labels.length - active.length} paused` : 'All active'}
        />
        <StatTile
          label="Active labels"
          value={active.length}
          hint="Customers pick from these"
        />
        <StatTile
          label="Dine-in checkout"
          value={active.length > 0 ? 'Table required' : 'Unchanged'}
          hint={
            active.length > 0
              ? 'Customers choose a table before paying'
              : 'No table step, same as today'
          }
        />
      </StatGrid>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="min-w-0 space-y-4">
          <SectionCard
            title="Add tables"
            description="Create a run of numbered tables in one go, then add the odd ones by hand."
            padding="tight"
          >
            <div className="grid gap-3 sm:grid-cols-[1fr_88px_88px_auto]">
              <FormField label="Prefix" htmlFor="bulk-prefix">
                {(field) => (
                  <TextInput
                    {...field}
                    value={prefix}
                    onChange={(event) => setPrefix(event.target.value.slice(0, 12))}
                    placeholder="Table"
                  />
                )}
              </FormField>
              <FormField label="From" htmlFor="bulk-start">
                {(field) => (
                  <TextInput
                    {...field}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={start}
                    onChange={(event) => setStart(event.target.value)}
                  />
                )}
              </FormField>
              <FormField label="How many" htmlFor="bulk-count">
                {(field) => (
                  <TextInput
                    {...field}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={count}
                    onChange={(event) => setCount(event.target.value)}
                  />
                )}
              </FormField>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={createSequence}
                  disabled={busy || !schemaReady}
                  className="dash-tap inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-[6px] bg-[var(--dash-brown)] px-4 text-[12.5px] font-semibold text-white hover:bg-[var(--dash-brown-deep)] disabled:opacity-50 sm:w-auto"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Create
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2 border-t border-[var(--dash-line)] pt-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <FormField
                  label="One-off label"
                  htmlFor="custom-label"
                  hint="Bar, Patio, Private room 2."
                >
                  {(field) => (
                    <TextInput
                      {...field}
                      value={custom}
                      maxLength={MAX_LABEL_LENGTH}
                      onChange={(event) => setCustom(event.target.value)}
                      placeholder="Bar"
                    />
                  )}
                </FormField>
              </div>
              <button
                type="button"
                onClick={createCustom}
                disabled={busy || !schemaReady || custom.trim().length === 0}
                className="dash-tap inline-flex h-11 items-center justify-center gap-1.5 rounded-[6px] border border-[var(--dash-line-strong)] bg-[var(--dash-surface)] px-4 text-[12.5px] font-semibold text-[var(--dash-ink-1)] hover:bg-[var(--dash-sand)] disabled:opacity-50"
              >
                <Plus className="size-4" aria-hidden="true" />
                Add label
              </button>
            </div>
          </SectionCard>

          <SectionCard
            title="Your tables"
            description="Order here is the order customers see at checkout. Disable a table instead of deleting it when a corner is temporarily out of use."
            padding="tight"
            action={
              <span className="dash-num text-[11.5px] text-[var(--dash-ink-3)]">
                {labels.length} total
              </span>
            }
          >
            {labels.length === 0 ? (
              <EmptyState
                icon={Table2}
                title="No tables yet"
                description="Create your first run of tables above. Until you do, dine-in checkout stays exactly as it is today: no table step."
              />
            ) : (
              <ul className="divide-y divide-[var(--dash-line)]">
                {labels.map((label, index) => (
                  <li key={label.id} className="flex items-center gap-2 py-2.5 first:pt-1 last:pb-1">
                    <span className="dash-num w-6 flex-shrink-0 text-[11.5px] text-[var(--dash-ink-4)]">
                      {index + 1}
                    </span>

                    {renamingId === label.id ? (
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <TextInput
                          value={renameValue}
                          maxLength={MAX_LABEL_LENGTH}
                          onChange={(event) => setRenameValue(event.target.value)}
                          compact
                          aria-label={`Rename ${label.label}`}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const value = renameValue.trim();
                            if (!value) return;
                            const ok = await patchLabel(label.id, { label: value }, 'Label renamed.');
                            if (ok) setRenamingId(null);
                          }}
                          className="dash-tap inline-flex size-10 flex-shrink-0 items-center justify-center rounded-[6px] text-[var(--dash-brown)] hover:bg-[var(--dash-sand)]"
                          aria-label="Save name"
                        >
                          <Check className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenamingId(null)}
                          className="dash-tap inline-flex size-10 flex-shrink-0 items-center justify-center rounded-[6px] text-[var(--dash-ink-3)] hover:bg-[var(--dash-sand)]"
                          aria-label="Cancel rename"
                        >
                          <X className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(label.id);
                          setRenameValue(label.label);
                        }}
                        className="dash-tap min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-[var(--dash-ink-1)] hover:text-[var(--dash-brown)]"
                      >
                        {label.label}
                        {!label.is_active && (
                          <span className="ml-2 rounded-full border border-[var(--dash-line-strong)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--dash-ink-3)]">
                            Paused
                          </span>
                        )}
                      </button>
                    )}

                    <div className="flex flex-shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => void move(index, -1)}
                        disabled={index === 0 || busy}
                        className="dash-tap inline-flex size-9 items-center justify-center rounded-[6px] text-[var(--dash-ink-3)] hover:bg-[var(--dash-sand)] disabled:opacity-30"
                        aria-label={`Move ${label.label} up`}
                      >
                        <ArrowUp className="size-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void move(index, 1)}
                        disabled={index === labels.length - 1 || busy}
                        className="dash-tap inline-flex size-9 items-center justify-center rounded-[6px] text-[var(--dash-ink-3)] hover:bg-[var(--dash-sand)] disabled:opacity-30"
                        aria-label={`Move ${label.label} down`}
                      >
                        <ArrowDown className="size-3.5" aria-hidden="true" />
                      </button>
                      <div className="px-1">
                        <Toggle
                          id={`label-active-${label.id}`}
                          checked={label.is_active}
                          onChange={(next) =>
                            void patchLabel(
                              label.id,
                              { is_active: next },
                              next ? `${label.label} is active.` : `${label.label} paused.`,
                            )
                          }
                          disabled={busy}
                          label={<span className="sr-only">Active</span>}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfirmRemove(label)}
                        disabled={busy}
                        className="dash-tap inline-flex size-9 items-center justify-center rounded-[6px] text-[var(--dash-ink-3)] hover:border-[var(--dash-danger)] hover:text-[var(--dash-danger)] disabled:opacity-40"
                        aria-label={`Remove ${label.label}`}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="min-w-0 space-y-4">
          <SectionCard title="Table QR sheet" padding="tight">
            <p className="text-[12px] leading-relaxed text-[var(--dash-ink-3)]">
              One card per active table. Put them on the tables; a scan opens your storefront with the
              table already chosen.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowSheet(true);
                // Let the sheet paint before the print dialog takes over.
                setTimeout(() => window.print(), 60);
              }}
              disabled={sheetLabels.length === 0}
              className="dash-tap mt-3 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-[6px] bg-[var(--dash-brown)] px-4 text-[12.5px] font-semibold text-white hover:bg-[var(--dash-brown-deep)] disabled:opacity-40"
            >
              <Printer className="size-4" aria-hidden="true" />
              Print {sheetLabels.length > 0 ? `${sheetLabels.length} cards` : 'sheet'}
            </button>
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--dash-ink-3)]">
              A4, three per row. Cards carry your restaurant name and the table, nothing else.
            </p>
          </SectionCard>

          <SectionCard title="How a table order arrives" padding="tight">
            <ol className="space-y-2.5 text-[12px] leading-relaxed text-[var(--dash-ink-3)]">
              {[
                'The code opens your storefront with the table preselected.',
                'At checkout the customer confirms the table, or picks a different one.',
                'Your order board, receipt and notification all show the table.',
              ].map((line, index) => (
                <li key={line} className="flex gap-2">
                  <span className="dash-num flex size-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--dash-sand)] text-[10.5px] font-bold text-[var(--dash-brown)]">
                    {index + 1}
                  </span>
                  <span className="min-w-0">{line}</span>
                </li>
              ))}
            </ol>
          </SectionCard>
        </div>
      </div>

      {/* Printable sheet. Hidden on screen, forced visible by the print styles. */}
      <div className={`qr-print-area ${showSheet ? '' : 'hidden'}`} aria-hidden={!showSheet}>
        <div className="qr-sheet">
          <header className="qr-sheet-head">
            <div>
              <p className="qr-sheet-eyebrow">Order at your table</p>
              <h2 className="qr-sheet-title">{data.business.name}</h2>
            </div>
            <p className="qr-sheet-note">
              Scan the code, order and pay. We bring it to your table.
            </p>
          </header>

          <div className="qr-grid">
            {sheetLabels.map((label) => (
              <article key={label.id} className="qr-card">
                <p className="qr-card-eyebrow">{data.business.name}</p>
                <p className="qr-card-table">{label.label}</p>
                <div className="qr-card-code">
                  <QRCodeSVG
                    value={tableUrl(label.label)}
                    size={132}
                    level="M"
                    bgColor="#FFFFFF"
                    fgColor="#141210"
                    includeMargin={false}
                  />
                </div>
                <p className="qr-card-cta">Scan to order</p>
                <p className="qr-card-url">
                  {origin.replace(/^https?:\/\//, '')}/{data.business.slug}
                </p>
              </article>
            ))}
          </div>

          <footer className="qr-sheet-foot">
            <span>Tables without a card: ask staff for help ordering.</span>
            <span>{data.business.slug}</span>
          </footer>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(confirmRemove)}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
        title={`Remove ${confirmRemove?.label ?? 'this table'}?`}
        description="The label disappears from checkout. Orders already placed keep the table they were sent to. If the table is only temporarily out of use, pause it instead."
        confirmLabel="Remove label"
        onConfirm={removeLabel}
        loading={busy}
      />
    </>
  );
}

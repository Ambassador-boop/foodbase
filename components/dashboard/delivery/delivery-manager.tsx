'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Circle,
  Crosshair,
  Info,
  MapPin,
  Pencil,
  Plus,
  Route,
  Save,
  Shapes,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormField,
  InsetPanel,
  Notice,
  PageSkeleton,
  PageContainer,
  PageHeader,
  SectionCard,
  SplitLayout,
  StatGrid,
  StatTile,
  TextInput,
  Toggle,
  toast,
} from '@/components/dashboard';
import { AreaMap, type AreaMapDraft } from '@/components/dashboard/delivery/area-map';
import { AddressSearch, type AddressResult } from '@/components/delivery/address-search';
import type { DeliveryArea, DeliveryAreaType, LatLng } from '@/lib/delivery/types';

/* ------------------------------- helpers ---------------------------------- */

const naira = (value: number | string | null | undefined) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `₦${Math.round(n).toLocaleString('en-NG')}`;
};

const TYPE_LABEL: Record<DeliveryAreaType, string> = {
  flat: 'Flat fee',
  radius: 'Radius',
  polygon: 'Drawn area',
  isochrone: 'Drive time',
};

const TYPE_HINT: Record<DeliveryAreaType, string> = {
  flat: 'One fee for every address. Use it when you charge the same everywhere.',
  radius: 'A circle around a point. Fast to set up, easy to explain to a rider.',
  polygon: 'Draw the streets you cover. The most accurate shape for a dense area.',
  isochrone: 'The area reachable in a given drive time. Best when distance is a poor proxy for traffic.',
};

function km2(sqm: number | null | undefined): string | null {
  const n = Number(sqm);
  if (!Number.isFinite(n) || n <= 0) return null;
  const value = n / 1_000_000;
  if (value >= 10) return `${Math.round(value)} km²`;
  return `${value.toFixed(1)} km²`;
}

type DraftState = {
  id: string | null;
  name: string;
  areaType: DeliveryAreaType;
  fee: string;
  minOrder: string;
  threshold: string;
  isActive: boolean;
  priority: string;
  center: LatLng | null;
  radiusM: number;
  polygon: LatLng[];
  isochroneMinutes: number;
  isochroneGeometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: any } | null;
};

const emptyDraft = (): DraftState => ({
  id: null,
  name: '',
  areaType: 'radius',
  fee: '1500',
  minOrder: '',
  threshold: '',
  isActive: true,
  priority: '0',
  center: null,
  radiusM: 3000,
  polygon: [],
  isochroneMinutes: 15,
  isochroneGeometry: null,
});

function draftFromArea(area: DeliveryArea): DraftState {
  return {
    id: area.id,
    name: area.name,
    areaType: area.area_type,
    fee: String(Number(area.fee) || 0),
    minOrder: area.min_order != null ? String(area.min_order) : '',
    threshold: area.free_delivery_threshold != null ? String(area.free_delivery_threshold) : '',
    isActive: area.is_active,
    priority: String(area.priority ?? 0),
    center:
      area.center_lat != null && area.center_lng != null
        ? { lat: Number(area.center_lat), lng: Number(area.center_lng) }
        : null,
    radiusM: Number(area.radius_m) || 3000,
    polygon:
      area.area_type === 'polygon' && area.polygon
        ? extractRing(area.polygon)
        : [],
    isochroneMinutes: Number(area.isochrone_minutes) || 15,
    isochroneGeometry: area.area_type === 'isochrone' ? area.isochrone_geometry : null,
  };
}

function extractRing(geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: any } | null): LatLng[] {
  if (!geometry) return [];
  const first =
    geometry.type === 'Polygon' ? geometry.coordinates?.[0] : geometry.coordinates?.[0]?.[0];
  if (!Array.isArray(first)) return [];
  const points = first
    .map((pair: any) => ({ lat: Number(pair?.[1]), lng: Number(pair?.[0]) }))
    .filter((point: LatLng) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  if (points.length > 1) {
    const a = points[0];
    const b = points[points.length - 1];
    if (Math.abs(a.lat - b.lat) < 1e-9 && Math.abs(a.lng - b.lng) < 1e-9) points.pop();
  }
  return points;
}

type DeliveryResponse = {
  schema: { deliveryAreas: boolean; businessGeo: boolean; prepTime: boolean };
  mapboxConfigured: boolean;
  prepTimeMinutes: number;
  prepTimeIsSet: boolean;
  location: LatLng | null;
  address: string | null;
  city: string | null;
  state: string | null;
  business: { id: string; name: string; slug: string; address: string | null };
  areas: DeliveryArea[];
};

/* ------------------------------- component -------------------------------- */

export function DeliveryManager() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<DeliveryResponse | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<DeliveryArea | null>(null);
  const [prepTime, setPrepTime] = useState('20');
  const [savingPrep, setSavingPrep] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const [testAddress, setTestAddress] = useState<{ point: LatLng; label: string } | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const response = await fetch('/api/business/delivery');
      if (!response.ok) throw new Error('failed');
      const payload: DeliveryResponse = await response.json();
      setData(payload);
      setPrepTime(String(payload.prepTimeMinutes ?? 20));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const areas = data?.areas ?? [];
  const activeAreas = areas.filter((area) => area.is_active);
  const schemaReady = data?.schema.deliveryAreas ?? false;
  const mapboxReady = data?.mapboxConfigured ?? false;

  const feeRange = useMemo(() => {
    if (activeAreas.length === 0) return '—';
    const fees = activeAreas.map((area) => Number(area.fee) || 0);
    const min = Math.min(...fees);
    const max = Math.max(...fees);
    return min === max ? naira(min) : `${naira(min)} – ${naira(max)}`;
  }, [activeAreas]);

  const coverage = useMemo(
    () => km2(activeAreas.reduce((sum, area) => sum + (Number(area.area_sqm) || 0), 0)),
    [activeAreas],
  );

  /* ------------------------------- editing ------------------------------- */

  const startNew = () => {
    setErrors({});
    setDraft({ ...emptyDraft(), center: data?.location ?? null });
  };

  const startEdit = (area: DeliveryArea) => {
    setErrors({});
    setDraft(draftFromArea(area));
  };

  const closeDraft = () => {
    setDraft(null);
    setErrors({});
  };

  const onMapClick = (point: LatLng) => {
    if (!draft) return;
    if (draft.areaType === 'polygon') {
      setDraft({ ...draft, polygon: [...draft.polygon, point] });
      return;
    }
    if (draft.areaType === 'radius' || draft.areaType === 'isochrone') {
      setDraft({ ...draft, center: point, isochroneGeometry: null });
    }
  };

  const validateDraft = (value: DraftState): Record<string, string> => {
    const next: Record<string, string> = {};
    if (!value.name.trim()) next.name = 'Give the area a name customers would recognise.';
    const fee = Number(value.fee);
    if (!Number.isFinite(fee) || fee < 0) next.fee = 'Enter the fee in naira, or 0 for free delivery.';
    if (value.minOrder !== '' && (!Number.isFinite(Number(value.minOrder)) || Number(value.minOrder) < 0)) {
      next.min_order = 'Enter a minimum order in naira.';
    }
    if (
      value.threshold !== '' &&
      (!Number.isFinite(Number(value.threshold)) || Number(value.threshold) < 0)
    ) {
      next.free_delivery_threshold = 'Enter a free-delivery threshold in naira.';
    }
    if (
      value.threshold !== '' &&
      value.minOrder !== '' &&
      Number(value.threshold) < Number(value.minOrder)
    ) {
      next.free_delivery_threshold = 'The threshold is below the minimum order, so it can never apply.';
    }
    if (value.areaType === 'radius') {
      if (!value.center) next.center = 'Place the centre pin on the map.';
      if (value.radiusM < 200 || value.radiusM > 50000) next.radius_m = 'Choose a radius between 0.2 km and 50 km.';
    }
    if (value.areaType === 'polygon' && value.polygon.length < 3) {
      next.polygon = 'Add at least three points on the map to close the area.';
    }
    if (value.areaType === 'isochrone') {
      if (!value.center) next.center = 'Place the centre pin on the map.';
      if (!value.isochroneGeometry) next.isochrone_geometry = 'Generate the drive-time zone before saving.';
    }
    return next;
  };

  const saveArea = async () => {
    if (!draft) return;
    const found = validateDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error('Check the highlighted fields.');
      return;
    }

    setSaving(true);
    try {
      const polygon =
        draft.areaType === 'polygon' && draft.polygon.length >= 3
          ? {
              type: 'Polygon' as const,
              coordinates: [
                [...draft.polygon.map((point) => [point.lng, point.lat]), [draft.polygon[0].lng, draft.polygon[0].lat]],
              ],
            }
          : null;

      const payload = {
        name: draft.name.trim(),
        area_type: draft.areaType,
        fee: Number(draft.fee),
        min_order: draft.minOrder === '' ? null : Number(draft.minOrder),
        free_delivery_threshold: draft.threshold === '' ? null : Number(draft.threshold),
        is_active: draft.isActive,
        priority: Number(draft.priority) || 0,
        center_lat: draft.center?.lat ?? null,
        center_lng: draft.center?.lng ?? null,
        radius_m: draft.areaType === 'radius' ? draft.radiusM : null,
        polygon,
        isochrone_minutes: draft.areaType === 'isochrone' ? draft.isochroneMinutes : null,
        isochrone_geometry: draft.areaType === 'isochrone' ? draft.isochroneGeometry : null,
      };

      const response = await fetch(
        draft.id ? `/api/business/delivery/areas/${draft.id}` : '/api/business/delivery/areas',
        {
          method: draft.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        if (result?.fields) setErrors(result.fields);
        toast.error(result?.error || 'Could not save this area.');
        return;
      }
      toast.success(draft.id ? 'Area updated.' : 'Area added.');
      closeDraft();
      await load();
    } catch {
      toast.error('Could not save this area.');
    } finally {
      setSaving(false);
    }
  };

  const toggleArea = async (area: DeliveryArea, next: boolean) => {
    setBusyId(area.id);
    try {
      const response = await fetch(`/api/business/delivery/areas/${area.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: next }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result?.error || 'Could not update this area.');
        return;
      }
      setData((current) =>
        current
          ? {
              ...current,
              areas: current.areas.map((row) =>
                row.id === area.id ? { ...row, is_active: next } : row,
              ),
            }
          : current,
      );
    } catch {
      toast.error('Could not update this area.');
    } finally {
      setBusyId(null);
    }
  };

  const removeArea = async () => {
    if (!confirmRemove) return;
    setBusyId(confirmRemove.id);
    try {
      const response = await fetch(`/api/business/delivery/areas/${confirmRemove.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const result = await response.json();
        toast.error(result?.error || 'Could not remove this area.');
        return;
      }
      toast.success('Area removed.');
      setConfirmRemove(null);
      await load();
    } catch {
      toast.error('Could not remove this area.');
    } finally {
      setBusyId(null);
    }
  };

  const generateIsochrone = async () => {
    if (!draft?.center) {
      setErrors({ ...errors, center: 'Place the centre pin on the map first.' });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/business/delivery/isochrone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: draft.center.lat,
          lng: draft.center.lng,
          minutes: draft.isochroneMinutes,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result?.error || 'Could not build that zone.');
        return;
      }
      setDraft({ ...draft, isochroneGeometry: result.geometry });
      setErrors((current) => ({ ...current, isochrone_geometry: '' }));
      toast.success('Zone built. Save the area to keep it.');
    } catch {
      toast.error('Could not build that zone.');
    } finally {
      setSaving(false);
    }
  };

  const savePrepTime = async () => {
    setSavingPrep(true);
    try {
      const response = await fetch('/api/business/delivery', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prepTimeMinutes: Number(prepTime) }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result?.error || 'Could not save the prep time.');
        return;
      }
      toast.success('Prep time saved. Delivery estimates use it.');
      setData((current) => (current ? { ...current, prepTimeMinutes: result.prepTimeMinutes } : current));
    } catch {
      toast.error('Could not save the prep time.');
    } finally {
      setSavingPrep(false);
    }
  };

  const saveRestaurantPin = async (result: AddressResult) => {
    setSavingPin(true);
    try {
      const response = await fetch('/api/business/delivery', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: result.lat, longitude: result.lng }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error || 'Could not save the restaurant pin.');
        return;
      }
      toast.success('Restaurant pin saved.');
      setData((current) =>
        current ? { ...current, location: { lat: result.lat, lng: result.lng } } : current,
      );
    } catch {
      toast.error('Could not save the restaurant pin.');
    } finally {
      setSavingPin(false);
    }
  };

  const runAddressTest = async (result: AddressResult) => {
    if (!data) return;
    setTestAddress({ point: { lat: result.lat, lng: result.lng }, label: result.placeName || result.name });
    setTesting(true);
    try {
      const response = await fetch('/api/delivery/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: data.business.id,
          deliveryType: 'delivery',
          subtotal: 10000,
          lat: result.lat,
          lng: result.lng,
        }),
      });
      const payload = await response.json();
      setTestResult(payload?.quote ?? null);
    } catch {
      setTestResult(null);
    } finally {
      setTesting(false);
    }
  };

  /* -------------------------------- render -------------------------------- */

  if (status === 'loading') {
    return (
      <div className="dash-surface">
        <PageContainer>
          <PageSkeleton />
        </PageContainer>
      </div>
    );
  }

  if (status === 'error' || !data) {
    return (
      <div className="dash-surface">
        <PageContainer>
          <PageHeader eyebrow="Storefront" title="Delivery areas" />
          <div className="mt-6">
            <ErrorState
              title="Delivery settings could not load"
              description="This is a connection problem on our side, not a problem with your settings. Nothing has changed."
              onRetry={() => void load()}
              retryLabel="Try again"
            />
          </div>
        </PageContainer>
      </div>
    );
  }

  const mapFocus =
    draft?.center ??
    (draft?.polygon.length ? draft.polygon[0] : null) ??
    data.location ??
    null;

  const draftForMap: AreaMapDraft | null = draft
    ? {
        areaType: draft.areaType,
        center: draft.center,
        radiusM: draft.radiusM,
        polygon: draft.polygon,
        isochroneGeometry: draft.isochroneGeometry,
      }
    : null;

  return (
    <div className="dash-surface">
      <PageContainer>
        <PageHeader
          eyebrow="Storefront"
          title="Delivery areas"
          description="Where you deliver, and what it costs to get there. Customers see the fee before they pay, and the fee is always calculated on our server from the pin they drop."
          meta={
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--dash-ink-3)]">
              <span className="dash-num">{activeAreas.length} active</span>
              <span aria-hidden="true">·</span>
              <span>Smallest matching area wins</span>
              {coverage && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="dash-num">{coverage} covered</span>
                </>
              )}
            </div>
          }
          actions={
            <button
              type="button"
              onClick={startNew}
              disabled={!schemaReady}
              className="dash-tap inline-flex h-11 items-center gap-1.5 rounded-[6px] bg-[var(--dash-brown)] px-4 text-[12.5px] font-semibold text-white transition-colors hover:bg-[var(--dash-brown-deep)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="size-4" aria-hidden="true" />
              Add area
            </button>
          }
        />

        {!schemaReady && (
          <div className="mt-5">
            <Notice tone="warning" title="One database step is still pending">
              Delivery areas need two tables and a few nullable columns added to your database before
              they can be saved. Run the Batch 3B migration, then reload this page. Until then, orders
              keep the fee they have today and nothing here is lost.
            </Notice>
          </div>
        )}

        {schemaReady && !mapboxReady && (
          <div className="mt-5">
            <Notice tone="info" title="Map editor is off">
              No Mapbox token is set, so areas cannot be drawn on a map. A flat fee for every address
              still works, and customers keep ordering with the address they type.
            </Notice>
          </div>
        )}

        <div className="mt-6">
          <StatGrid>
            <StatTile
              label="Active areas"
              value={activeAreas.length}
              unit={activeAreas.length === 1 ? 'area' : 'areas'}
              hint={
                areas.length > activeAreas.length
                  ? `${areas.length - activeAreas.length} paused`
                  : 'Every saved area is live'
              }
            />
            <StatTile label="Delivery fees" value={feeRange} hint="Across active areas" />
            <StatTile
              label="Kitchen prep"
              value={data.prepTimeMinutes}
              unit="min"
              hint={data.prepTimeIsSet ? 'Used in delivery estimates' : 'Default, not set yet'}
            />
          </StatGrid>
        </div>

        <div className="mt-6">
          <SplitLayout
            sideWidth={320}
            main={
              <div className="space-y-4">
                {draft ? (
                  <AreaEditor
                    draft={draft}
                    setDraft={setDraft}
                    errors={errors}
                    saving={saving}
                    mapboxReady={mapboxReady}
                    areas={areas}
                    restaurantPin={data.location}
                    mapFocus={mapFocus}
                    draftForMap={draftForMap}
                    onMapClick={onMapClick}
                    onSave={saveArea}
                    onCancel={closeDraft}
                    onGenerateIsochrone={generateIsochrone}
                  />
                ) : (
                  <>
                    <SectionCard
                      title="Coverage"
                      description={
                        activeAreas.length > 0
                          ? 'Active areas are solid, paused areas are dashed. Overlaps are priced by the smallest area that contains the address.'
                          : 'Nothing is drawn yet. Add a flat fee to start taking delivery orders, then carve out neighbourhoods when you have a feel for your own costs.'
                      }
                      padding="tight"
                    >
                      {areas.length === 0 ? (
                        <EmptyState
                          icon={Shapes}
                          title="No delivery areas yet"
                          description="Without areas, delivery has no fee and customers can order to any address you can reach. Adding areas lets you charge by distance, enforce a minimum order, and refuse streets you cannot serve."
                          action={
                            <button
                              type="button"
                              onClick={startNew}
                              disabled={!schemaReady}
                              className="dash-tap inline-flex h-11 items-center gap-1.5 rounded-[6px] bg-[var(--dash-brown)] px-4 text-[12.5px] font-semibold text-white disabled:opacity-50"
                            >
                              <Plus className="size-4" aria-hidden="true" />
                              Add the first area
                            </button>
                          }
                        />
                      ) : (
                        <AreaMap
                          areas={areas}
                          restaurantPin={data.location}
                          height={340}
                          focus={data.location}
                        />
                      )}
                    </SectionCard>

                    {areas.length > 0 && (
                      <SectionCard
                        title="Your areas"
                        description="Fees are per area. A customer's pin decides which one applies."
                        padding="tight"
                        action={
                          <span className="dash-num text-[11.5px] text-[var(--dash-ink-3)]">
                            {areas.length} saved
                          </span>
                        }
                      >
                        <ul className="divide-y divide-[var(--dash-line)]">
                          {areas.map((area) => (
                            <AreaRow
                              key={area.id}
                              area={area}
                              busy={busyId === area.id}
                              onEdit={() => startEdit(area)}
                              onToggle={(next) => toggleArea(area, next)}
                              onRemove={() => setConfirmRemove(area)}
                            />
                          ))}
                        </ul>
                      </SectionCard>
                    )}
                  </>
                )}
              </div>
            }
            side={
              <div className="space-y-4">
                <SectionCard title="Kitchen prep time" padding="tight">
                  <p className="text-[12px] leading-relaxed text-[var(--dash-ink-3)]">
                    How long the kitchen needs before a rider leaves. Delivery estimates add travel
                    time on top of this.
                  </p>
                  <div className="mt-3 flex items-end gap-2">
                    <FormField label="Prep time" htmlFor="prep-time" hint="1 to 240 minutes">
                      {(field) => (
                        <div className="flex items-center gap-2">
                          <TextInput
                            {...field}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={240}
                            value={prepTime}
                            onChange={(event) => setPrepTime(event.target.value)}
                            compact
                            className="w-24"
                          />
                          <span className="pb-2 text-[12px] text-[var(--dash-ink-3)]">minutes</span>
                        </div>
                      )}
                    </FormField>
                  </div>
                  <button
                    type="button"
                    onClick={savePrepTime}
                    disabled={savingPrep}
                    className="dash-tap mt-3 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-[6px] border border-[var(--dash-line-strong)] bg-[var(--dash-surface)] text-[12.5px] font-semibold text-[var(--dash-ink-1)] hover:bg-[var(--dash-sand)] disabled:opacity-60"
                  >
                    <Save className="size-4" aria-hidden="true" />
                    {savingPrep ? 'Saving…' : 'Save prep time'}
                  </button>
                </SectionCard>

                <SectionCard title="Restaurant pin" padding="tight">
                  {data.schema.businessGeo ? (
                    <>
                      <p className="text-[12px] leading-relaxed text-[var(--dash-ink-3)]">
                        The point travel time is measured from. Set it once, then radius and
                        drive-time areas can start here.
                      </p>
                      <div className="mt-3 space-y-2">
                        {mapboxReady ? (
                          <AddressSearch
                            onSelect={saveRestaurantPin}
                            placeholder="Search your restaurant address"
                          />
                        ) : (
                          <p className="text-[11.5px] text-[var(--dash-ink-3)]">
                            Address search needs Mapbox.
                          </p>
                        )}
                        <p className="dash-num text-[11.5px] text-[var(--dash-ink-3)]">
                          {data.location
                            ? `${data.location.lat.toFixed(5)}, ${data.location.lng.toFixed(5)}`
                            : 'Not set yet'}
                        </p>
                        {savingPin && (
                          <p className="text-[11.5px] text-[var(--dash-ink-3)]">Saving pin…</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-[12px] leading-relaxed text-[var(--dash-ink-3)]">
                      Pin storage is part of the pending database step. Your restaurant address stays
                      as typed on the storefront until then.
                    </p>
                  )}
                </SectionCard>

                {areas.length > 0 && mapboxReady && (
                  <SectionCard title="Check an address" padding="tight">
                    <p className="text-[12px] leading-relaxed text-[var(--dash-ink-3)]">
                      The same check a customer gets at checkout, using your saved areas.
                    </p>
                    <div className="mt-3">
                      <AddressSearch onSelect={runAddressTest} placeholder="Try a customer address" />
                    </div>
                    <div className="mt-3" aria-live="polite">
                      {!testAddress && (
                        <p className="text-[11.5px] text-[var(--dash-ink-3)]">
                          Nothing checked yet.
                        </p>
                      )}
                      {testAddress && testing && (
                        <p className="text-[11.5px] text-[var(--dash-ink-3)]">Checking…</p>
                      )}
                      {testAddress && !testing && testResult && (
                        <div className="space-y-1.5">
                          <p className="text-[12px] font-semibold text-[var(--dash-ink-1)]">
                            {testResult.deliverable
                              ? testResult.areaName
                                ? `Inside ${testResult.areaName}`
                                : 'Deliverable, no area fee'
                              : 'Outside every area'}
                          </p>
                          {testResult.deliverable ? (
                            <p className="text-[11.5px] text-[var(--dash-ink-3)]">
                              Fee {naira(testResult.fee)} on a ₦10,000 basket
                              {testResult.estimatedMinutes
                                ? ` · ${testResult.estimatedMinutes.min}–${testResult.estimatedMinutes.max} min`
                                : ''}
                              {testResult.belowMinimum
                                ? ` · minimum ${naira(testResult.minOrder)}`
                                : ''}
                            </p>
                          ) : (
                            <p className="text-[11.5px] text-[var(--dash-ink-3)]">{testResult.message}</p>
                          )}
                          <p className="truncate text-[11px] text-[var(--dash-ink-4)]">
                            {testAddress.label}
                          </p>
                        </div>
                      )}
                    </div>
                  </SectionCard>
                )}

                <SectionCard title="How the fee is decided" padding="tight">
                  <ol className="space-y-2.5 text-[12px] leading-relaxed text-[var(--dash-ink-3)]">
                    {[
                      'The customer drops a pin at checkout. The fee is calculated from that point, never from anything the browser sends.',
                      'The smallest area containing the point sets the fee. A tighter zone always beats a wider one.',
                      'The minimum order is checked first, then the free-delivery threshold.',
                      'An address outside every active area is refused, with the reason shown at checkout.',
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
            }
          />
        </div>

        <ConfirmDialog
          open={Boolean(confirmRemove)}
          onOpenChange={(open) => !open && setConfirmRemove(null)}
          title={`Remove ${confirmRemove?.name ?? 'this area'}?`}
          description="Customers outside your other areas will no longer be able to order delivery here. Orders already placed keep their fee."
          confirmLabel="Remove area"
          onConfirm={removeArea}
          loading={Boolean(busyId)}
        />
      </PageContainer>
    </div>
  );
}

/* ------------------------------- area row ---------------------------------- */

function AreaRow({
  area,
  busy,
  onEdit,
  onToggle,
  onRemove,
}: {
  area: DeliveryArea;
  busy: boolean;
  onEdit: () => void;
  onToggle: (next: boolean) => void;
  onRemove: () => void;
}) {
  const size = km2(area.area_sqm);
  const radius = Number(area.radius_m);
  const geometryNote =
    area.area_type === 'radius' && radius
      ? `${(radius / 1000).toFixed(radius % 1000 === 0 ? 0 : 1)} km radius`
      : area.area_type === 'isochrone'
        ? `${area.isochrone_minutes ?? '—'} min drive`
        : area.area_type === 'polygon'
          ? size ?? 'Drawn area'
          : 'Every address';

  return (
    <li className="flex flex-col gap-3 py-3 first:pt-1 last:pb-1 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-[13.5px] font-semibold text-[var(--dash-ink-1)]">
            {area.name}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--dash-sand)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--dash-brown)]">
            {area.area_type === 'radius' && <Circle className="size-2.5" aria-hidden="true" />}
            {area.area_type === 'polygon' && <Shapes className="size-2.5" aria-hidden="true" />}
            {area.area_type === 'isochrone' && <Route className="size-2.5" aria-hidden="true" />}
            {TYPE_LABEL[area.area_type]}
          </span>
          {!area.is_active && (
            <span className="rounded-full border border-[var(--dash-line-strong)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--dash-ink-3)]">
              Paused
            </span>
          )}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-[var(--dash-ink-3)]">
          <span className="dash-num font-semibold text-[var(--dash-ink-1)]">{naira(area.fee)}</span>
          <span aria-hidden="true">·</span>
          <span>{geometryNote}</span>
          {area.min_order != null && (
            <>
              <span aria-hidden="true">·</span>
              <span className="dash-num">min {naira(area.min_order)}</span>
            </>
          )}
          {area.free_delivery_threshold != null && (
            <>
              <span aria-hidden="true">·</span>
              <span className="dash-num">free from {naira(area.free_delivery_threshold)}</span>
            </>
          )}
        </p>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1.5">
        <div className="mr-1">
          <Toggle
            id={`area-active-${area.id}`}
            checked={area.is_active}
            onChange={onToggle}
            disabled={busy}
            label={<span className="sr-only">Active</span>}
          />
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="dash-tap inline-flex size-11 items-center justify-center rounded-[6px] border border-[var(--dash-line-strong)] text-[var(--dash-ink-2)] hover:bg-[var(--dash-sand)]"
          aria-label={`Edit ${area.name}`}
        >
          <Pencil className="size-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          className="dash-tap inline-flex size-11 items-center justify-center rounded-[6px] border border-[var(--dash-line-strong)] text-[var(--dash-ink-3)] hover:border-[var(--dash-danger)] hover:text-[var(--dash-danger)] disabled:opacity-50"
          aria-label={`Remove ${area.name}`}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

/* ------------------------------- editor ------------------------------------ */

function AreaEditor({
  draft,
  setDraft,
  errors,
  saving,
  mapboxReady,
  areas,
  restaurantPin,
  mapFocus,
  draftForMap,
  onMapClick,
  onSave,
  onCancel,
  onGenerateIsochrone,
}: {
  draft: DraftState;
  setDraft: (next: DraftState) => void;
  errors: Record<string, string>;
  saving: boolean;
  mapboxReady: boolean;
  areas: DeliveryArea[];
  restaurantPin: LatLng | null;
  mapFocus: LatLng | null;
  draftForMap: AreaMapDraft | null;
  onMapClick: (point: LatLng) => void;
  onSave: () => void;
  onCancel: () => void;
  onGenerateIsochrone: () => void;
}) {
  const drawing = draft.areaType === 'polygon';

  return (
    <SectionCard
      title={draft.id ? `Editing ${draft.name || 'area'}` : 'New delivery area'}
      description="Name it the way a customer would talk about the place, then set the fee for getting there."
      padding="tight"
      action={
        <button
          type="button"
          onClick={onCancel}
          className="dash-tap inline-flex size-11 items-center justify-center rounded-[6px] text-[var(--dash-ink-3)] hover:bg-[var(--dash-sand)]"
          aria-label="Close area editor"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      }
    >
      <div className="space-y-4">
        {mapboxReady && (
          <div className="space-y-2">
            <AreaMap
              areas={areas.filter((area) => area.id !== draft.id)}
              draft={draftForMap}
              restaurantPin={restaurantPin}
              drawing={drawing}
              onMapClick={onMapClick}
              focus={mapFocus}
              height={320}
            />
            <DraftMapControls draft={draft} setDraft={setDraft} onGenerateIsochrone={onGenerateIsochrone} saving={saving} />
            {errors.center && <p className="text-[11.5px] font-medium text-[var(--dash-danger)]">{errors.center}</p>}
            {errors.polygon && <p className="text-[11.5px] font-medium text-[var(--dash-danger)]">{errors.polygon}</p>}
            {errors.radius_m && <p className="text-[11.5px] font-medium text-[var(--dash-danger)]">{errors.radius_m}</p>}
            {errors.isochrone_geometry && (
              <p className="text-[11.5px] font-medium text-[var(--dash-danger)]">{errors.isochrone_geometry}</p>
            )}
          </div>
        )}

        {!mapboxReady && (
          <Notice tone="info" title="Drawing needs Mapbox">
            Without a token, only a flat fee can be configured here. The fee still applies to every
            address and is enforced on the server.
          </Notice>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Area name" htmlFor="area-name" error={errors.name} required className="sm:col-span-2">
            {(field) => (
              <TextInput
                {...field}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Lekki Phase 1"
                invalid={Boolean(errors.name)}
                leading={
                  <span className="flex items-center gap-1 text-[11.5px]">
                    <MapPin className="size-3.5" aria-hidden="true" />
                  </span>
                }
              />
            )}
          </FormField>

          <div className="sm:col-span-2">
            <p className="mb-1 text-[12px] font-semibold text-[var(--dash-ink-1)]">Area type</p>
            <div role="radiogroup" aria-label="Area type" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {(['flat', 'radius', 'polygon', 'isochrone'] as DeliveryAreaType[]).map((type) => {
                const active = draft.areaType === type;
                const disabled = !mapboxReady && type !== 'flat';
                return (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={disabled}
                    onClick={() => setDraft({ ...draft, areaType: type })}
                    className={`dash-tap flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-[6px] border px-2 text-[12px] font-semibold transition-colors ${
                      active
                        ? 'border-[var(--dash-brown)] bg-[var(--dash-sand)] text-[var(--dash-brown)]'
                        : 'border-[var(--dash-line-strong)] bg-[var(--dash-surface)] text-[var(--dash-ink-2)] hover:bg-[var(--dash-sand)]'
                    } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <span className="truncate">{TYPE_LABEL[type]}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--dash-ink-3)]">
              {TYPE_HINT[draft.areaType]}
            </p>
          </div>

          <FormField label="Delivery fee" htmlFor="area-fee" error={errors.fee} required>
            {(field) => (
              <TextInput
                {...field}
                type="number"
                inputMode="numeric"
                min={0}
                value={draft.fee}
                onChange={(event) => setDraft({ ...draft, fee: event.target.value })}
                invalid={Boolean(errors.fee)}
                leading="₦"
              />
            )}
          </FormField>

          <FormField
            label="Minimum order"
            htmlFor="area-min"
            error={errors.min_order}
            optionalLabel
            hint="Below this, delivery is refused."
          >
            {(field) => (
              <TextInput
                {...field}
                type="number"
                inputMode="numeric"
                min={0}
                value={draft.minOrder}
                onChange={(event) => setDraft({ ...draft, minOrder: event.target.value })}
                invalid={Boolean(errors.min_order)}
                leading="₦"
              />
            )}
          </FormField>

          <FormField
            label="Free delivery from"
            htmlFor="area-threshold"
            error={errors.free_delivery_threshold}
            optionalLabel
            hint="Spend this much and the fee is waived."
          >
            {(field) => (
              <TextInput
                {...field}
                type="number"
                inputMode="numeric"
                min={0}
                value={draft.threshold}
                onChange={(event) => setDraft({ ...draft, threshold: event.target.value })}
                invalid={Boolean(errors.free_delivery_threshold)}
                leading="₦"
              />
            )}
          </FormField>

          <FormField
            label="Priority"
            htmlFor="area-priority"
            optionalLabel
            hint="Tie-break only, when two areas are the same size. Lower wins."
          >
            {(field) => (
              <TextInput
                {...field}
                type="number"
                inputMode="numeric"
                value={draft.priority}
                onChange={(event) => setDraft({ ...draft, priority: event.target.value })}
              />
            )}
          </FormField>
        </div>

        <InsetPanel>
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 size-3.5 flex-shrink-0 text-[var(--dash-ink-3)]" aria-hidden="true" />
            <p className="text-[11.5px] leading-relaxed text-[var(--dash-ink-3)]">
              {draft.areaType === 'flat'
                ? 'A flat fee covers every address. If you later draw a zone, the zone wins for addresses inside it because it is smaller.'
                : 'This area is measured when you save it, and its real size is what decides overlaps. A tighter area always beats a wider one.'}
            </p>
          </div>
        </InsetPanel>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--dash-line)] pt-3">
          <Toggle
            id="area-active"
            checked={draft.isActive}
            onChange={(next) => setDraft({ ...draft, isActive: next })}
            label="Active"
            description="Paused areas keep their settings but stop taking orders."
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="dash-tap inline-flex h-11 items-center justify-center rounded-[6px] border border-[var(--dash-line-strong)] px-4 text-[12.5px] font-semibold text-[var(--dash-ink-2)] hover:bg-[var(--dash-sand)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="dash-tap inline-flex h-11 items-center justify-center gap-1.5 rounded-[6px] bg-[var(--dash-brown)] px-5 text-[12.5px] font-semibold text-white hover:bg-[var(--dash-brown-deep)] disabled:opacity-60"
          >
            <Save className="size-4" aria-hidden="true" />
            {saving ? 'Saving…' : draft.id ? 'Save changes' : 'Add area'}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

function DraftMapControls({
  draft,
  setDraft,
  onGenerateIsochrone,
  saving,
}: {
  draft: DraftState;
  setDraft: (next: DraftState) => void;
  onGenerateIsochrone: () => void;
  saving: boolean;
}) {
  if (draft.areaType === 'flat') {
    return (
      <p className="text-[11.5px] text-[var(--dash-ink-3)]">
        A flat fee needs no shape. Every address is covered.
      </p>
    );
  }

  if (draft.areaType === 'polygon') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="dash-num text-[11.5px] text-[var(--dash-ink-3)]">
          {draft.polygon.length} {draft.polygon.length === 1 ? 'point' : 'points'} · click the map to add
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDraft({ ...draft, polygon: draft.polygon.slice(0, -1) })}
            disabled={draft.polygon.length === 0}
            className="dash-tap inline-flex h-11 items-center gap-1.5 rounded-[6px] border border-[var(--dash-line-strong)] px-3 text-[12px] font-semibold text-[var(--dash-ink-2)] hover:bg-[var(--dash-sand)] disabled:opacity-40"
          >
            <Undo2 className="size-3.5" aria-hidden="true" />
            Undo point
          </button>
          <button
            type="button"
            onClick={() => setDraft({ ...draft, polygon: [] })}
            disabled={draft.polygon.length === 0}
            className="dash-tap inline-flex h-11 items-center rounded-[6px] border border-[var(--dash-line-strong)] px-3 text-[12px] font-semibold text-[var(--dash-ink-2)] hover:bg-[var(--dash-sand)] disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </div>
    );
  }

  if (draft.areaType === 'radius') {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="radius-range" className="text-[12px] font-semibold text-[var(--dash-ink-1)]">
            Radius
          </label>
          <span className="dash-num text-[12px] font-semibold text-[var(--dash-brown)]">
            {(draft.radiusM / 1000).toFixed(draft.radiusM % 1000 === 0 ? 0 : 1)} km
          </span>
        </div>
        <input
          id="radius-range"
          type="range"
          min={200}
          max={20000}
          step={100}
          value={draft.radiusM}
          onChange={(event) => setDraft({ ...draft, radiusM: Number(event.target.value) })}
          className="h-11 w-full accent-[var(--dash-brown)]"
        />
        <p className="text-[11.5px] text-[var(--dash-ink-3)]">
          Click the map to move the centre. {draft.center ? 'Centre set.' : 'No centre yet.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-0">
        <label htmlFor="iso-minutes" className="mb-1 block text-[12px] font-semibold text-[var(--dash-ink-1)]">
          Drive time
        </label>
        <div className="flex items-center gap-2">
          <TextInput
            id="iso-minutes"
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            value={draft.isochroneMinutes}
            onChange={(event) => setDraft({ ...draft, isochroneMinutes: Number(event.target.value) })}
            compact
            className="w-20"
          />
          <span className="text-[12px] text-[var(--dash-ink-3)]">min</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onGenerateIsochrone}
        disabled={saving}
        className="dash-tap inline-flex h-11 items-center gap-1.5 rounded-[6px] border border-[var(--dash-line-strong)] px-3 text-[12px] font-semibold text-[var(--dash-ink-2)] hover:bg-[var(--dash-sand)] disabled:opacity-50"
      >
        <Crosshair className="size-3.5" aria-hidden="true" />
        {draft.isochroneGeometry ? 'Rebuild zone' : 'Generate zone'}
      </button>
      <span className="w-full text-[11.5px] text-[var(--dash-ink-3)]">
        {draft.isochroneGeometry
          ? 'Zone built. Move the centre and rebuild if it looks wrong.'
          : draft.center
            ? 'Generate the zone, then save the area.'
            : 'Click the map to place the centre first.'}
      </span>
    </div>
  );
}

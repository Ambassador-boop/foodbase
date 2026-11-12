'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MapPinOff } from 'lucide-react';
import { loadMapboxGl, hasMapboxToken } from '@/lib/mapbox/client';
import type { DeliveryArea, DeliveryAreaType, LatLng } from '@/lib/delivery/types';

/**
 * The delivery area editor map.
 *
 * One job: show what the restaurant covers, and capture the next thing it wants
 * to cover. Drawing is a plain map click sequence (click to drop a vertex, undo
 * the last one, finish) rather than a hosted drawing plugin: it gives a
 * deterministic undo, works on touch without a modifier key, and loads nothing
 * beyond mapbox-gl itself.
 *
 * Every geometry is drawn from the same GeoJSON that the server stores, so what
 * the owner sees here is exactly the shape the point-in-area test reads.
 */

type Draft = {
  areaType: DeliveryAreaType;
  center: LatLng | null;
  radiusM: number | null;
  polygon: LatLng[];
  isochroneGeometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: any } | null;
};

function circlePolygon(center: LatLng, radiusM: number, steps = 64) {
  const coords: number[][] = [];
  const latRad = (center.lat * Math.PI) / 180;
  const mPerDegLat = 111132.92 - 559.82 * Math.cos(2 * latRad) + 1.175 * Math.cos(4 * latRad);
  const mPerDegLng = 111412.84 * Math.cos(latRad) - 93.5 * Math.cos(3 * latRad);
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLat = (radiusM * Math.cos(angle)) / mPerDegLat;
    const dLng = (radiusM * Math.sin(angle)) / (mPerDegLng || 1);
    coords.push([center.lng + dLng, center.lat + dLat]);
  }
  return { type: 'Polygon' as const, coordinates: [coords] };
}

function areaGeometry(area: DeliveryArea) {
  if (area.area_type === 'polygon') return area.polygon;
  if (area.area_type === 'isochrone') return area.isochrone_geometry;
  if (
    area.area_type === 'radius' &&
    area.center_lat != null &&
    area.center_lng != null &&
    Number(area.radius_m) > 0
  ) {
    return circlePolygon(
      { lat: Number(area.center_lat), lng: Number(area.center_lng) },
      Number(area.radius_m),
    );
  }
  return null;
}

export function AreaMap({
  areas,
  draft,
  restaurantPin,
  drawing = false,
  onMapClick,
  focus,
  height = 380,
  className,
}: {
  areas: DeliveryArea[];
  draft?: Draft | null;
  restaurantPin?: LatLng | null;
  drawing?: boolean;
  onMapClick?: (point: LatLng) => void;
  focus?: LatLng | null;
  height?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const loadedRef = useRef(false);
  const clickRef = useRef(onMapClick);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>(
    hasMapboxToken() ? 'loading' : 'unavailable',
  );

  clickRef.current = onMapClick;

  const features = useMemo(() => {
    const collection: any[] = [];

    for (const area of areas) {
      const geometry = areaGeometry(area);
      if (!geometry) continue;
      collection.push({
        type: 'Feature',
        properties: {
          tone: area.is_active ? 'active' : 'inactive',
          label: area.name,
        },
        geometry,
      });
    }

    if (draft) {
      if (draft.isochroneGeometry) {
        collection.push({
          type: 'Feature',
          properties: { tone: 'draft', label: 'Drive-time zone' },
          geometry: draft.isochroneGeometry,
        });
      } else if (draft.areaType === 'radius' && draft.center && Number(draft.radiusM) > 0) {
        collection.push({
          type: 'Feature',
          properties: { tone: 'draft', label: 'Radius' },
          geometry: circlePolygon(draft.center, Number(draft.radiusM)),
        });
      } else if (draft.polygon.length >= 3) {
        const ring = draft.polygon.map((point) => [point.lng, point.lat]);
        ring.push([draft.polygon[0].lng, draft.polygon[0].lat]);
        collection.push({
          type: 'Feature',
          properties: { tone: 'draft', label: 'New area' },
          geometry: { type: 'Polygon', coordinates: [ring] },
        });
      }
    }

    return { type: 'FeatureCollection', features: collection };
  }, [areas, draft]);

  const vertices = useMemo(() => {
    const points: any[] = [];
    if (draft?.areaType === 'polygon') {
      draft.polygon.forEach((point, index) => {
        points.push({
          type: 'Feature',
          properties: { index },
          geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
        });
      });
    }
    return { type: 'FeatureCollection', features: points };
  }, [draft]);

  /* Create the map once. */
  useEffect(() => {
    if (!hasMapboxToken()) {
      setStatus('unavailable');
      return;
    }
    let cancelled = false;

    loadMapboxGl()
      .then((mapboxgl) => {
        if (cancelled) return;
        if (!mapboxgl || !containerRef.current || mapRef.current) {
          if (!mapboxgl) setStatus('unavailable');
          return;
        }

        const start = restaurantPin ?? focus ?? { lat: 6.4541, lng: 3.3947 };
        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: 'mapbox://styles/mapbox/light-v11',
          center: [start.lng, start.lat],
          zoom: restaurantPin || focus ? 12.4 : 10.8,
          attributionControl: true,
        });
        mapRef.current = map;
        map.dragRotate.disable();
        map.touchZoomRotate.disableRotation();

        map.on('load', () => {
          if (cancelled) return;
          loadedRef.current = true;

          map.addSource('areas', { type: 'geojson', data: features });
          map.addSource('vertices', { type: 'geojson', data: vertices });

          map.addLayer({
            id: 'areas-fill',
            type: 'fill',
            source: 'areas',
            paint: {
              'fill-color': [
                'match',
                ['get', 'tone'],
                'active', '#8E3800',
                'draft', '#1F6F5C',
                'inactive', '#8A8377',
                '#8E3800',
              ],
              'fill-opacity': ['match', ['get', 'tone'], 'draft', 0.16, 0.1],
            },
          });
          map.addLayer({
            id: 'areas-line',
            type: 'line',
            source: 'areas',
            paint: {
              'line-color': [
                'match',
                ['get', 'tone'],
                'active', '#8E3800',
                'draft', '#1F6F5C',
                'inactive', '#8A8377',
                '#8E3800',
              ],
              'line-width': ['match', ['get', 'tone'], 'draft', 2.4, 1.4],
              'line-dasharray': ['match', ['get', 'tone'], 'inactive', ['literal', [2, 2]], ['literal', [1, 0]]],
            },
          });
          map.addLayer({
            id: 'vertices',
            type: 'circle',
            source: 'vertices',
            paint: {
              'circle-radius': 5,
              'circle-color': '#FFFFFF',
              'circle-stroke-color': '#1F6F5C',
              'circle-stroke-width': 2,
            },
          });

          map.on('click', (event: any) => {
            clickRef.current?.({ lat: event.lngLat.lat, lng: event.lngLat.lng });
          });

          setStatus('ready');
        });

        map.on('error', () => {
          if (!loadedRef.current) setStatus('unavailable');
        });
      })
      .catch(() => {
        if (!cancelled) setStatus('unavailable');
      });

    return () => {
      cancelled = true;
    };
    // The map instance is created once and updated through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Keep the shapes in sync without rebuilding the map. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const source = map.getSource('areas');
    if (source) source.setData(features);
  }, [features]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const source = map.getSource('vertices');
    if (source) source.setData(vertices);
  }, [vertices]);

  /* Cursor affordance while the owner is drawing. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = drawing ? 'crosshair' : '';
  }, [drawing, status]);

  /* Centre the map on whatever the editor is working on. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !focus) return;
    map.easeTo({ center: [focus.lng, focus.lat], duration: 600 });
  }, [focus]);

  /* Release WebGL resources on unmount. */
  useEffect(() => {
    return () => {
      try {
        mapRef.current?.remove();
      } catch {
        /* already gone */
      }
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  if (status === 'unavailable') {
    return (
      <div
        className={
          className ??
          'flex flex-col items-start gap-2 rounded-[8px] border border-dashed border-[var(--dash-line-strong)] bg-[var(--dash-surface-sunken)] p-4'
        }
      >
        <span className="flex items-center gap-2 text-[12.5px] font-semibold text-[var(--dash-ink-2)]">
          <MapPinOff className="size-4 text-[var(--dash-ink-3)]" aria-hidden="true" />
          Map editor unavailable
        </span>
        <p className="max-w-[46ch] text-[12px] leading-relaxed text-[var(--dash-ink-3)]">
          Add <code className="dash-num rounded bg-[var(--dash-sand)] px-1 py-0.5 text-[11px]">NEXT_PUBLIC_MAPBOX_TOKEN</code>{' '}
          in Vercel to draw areas on a map. Until then you can still set a flat fee for every
          address, and customers keep ordering with the address they type.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        ref={containerRef}
        role="application"
        aria-label="Delivery area map. Click the map to place points."
        className="relative w-full overflow-hidden rounded-[8px] border border-[var(--dash-line)] bg-[var(--dash-surface-sunken)]"
        style={{ height }}
      />
      {status === 'loading' && (
        <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-[var(--dash-ink-3)]">
          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          Loading map…
        </p>
      )}
    </div>
  );
}

export type { Draft as AreaMapDraft };

'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { loadMapboxGl, hasMapboxToken } from '@/lib/mapbox/client';
import type { LatLng } from '@/lib/delivery/types';

/**
 * A small "is this the right door?" map.
 *
 * Used at checkout to let a customer nudge the pin after picking an address
 * from search. Three states, and the honest one matters most: if Mapbox cannot
 * load, this renders a quiet line of text and the coordinates from the address
 * search are still used. The order never depends on the map rendering.
 */

type State = 'loading' | 'ready' | 'unavailable';

export function PinMap({
  center,
  label = 'Delivery pin',
  height = 200,
  onChange,
  buttonClassName,
}: {
  center: LatLng | null;
  label?: string;
  height?: number;
  onChange?: (point: LatLng) => void;
  buttonClassName?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const [state, setState] = useState<State>(hasMapboxToken() ? 'loading' : 'unavailable');

  onChangeRef.current = onChange;

  // Create the map once.
  useEffect(() => {
    if (!hasMapboxToken()) {
      setState('unavailable');
      return;
    }
    let cancelled = false;

    loadMapboxGl()
      .then((mapboxgl) => {
        if (cancelled) return;
        if (!mapboxgl || !containerRef.current) {
          setState('unavailable');
          return;
        }
        if (mapRef.current) return;

        const start = center ?? { lat: 6.4541, lng: 3.3947 };
        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [start.lng, start.lat],
          zoom: 14,
          attributionControl: true,
        });
        mapRef.current = map;
        map.dragRotate.disable();
        map.touchZoomRotate.disableRotation();

        const marker = new mapboxgl.Marker({ color: '#8E3800', draggable: true })
          .setLngLat([start.lng, start.lat])
          .addTo(map);
        markerRef.current = marker;

        const emit = () => {
          const position = marker.getLngLat();
          onChangeRef.current?.({ lat: position.lat, lng: position.lng });
        };
        marker.on('dragend', emit);
        map.on('click', (event: any) => {
          marker.setLngLat(event.lngLat);
          onChangeRef.current?.({ lat: event.lngLat.lat, lng: event.lngLat.lng });
        });

        map.on('load', () => setState('ready'));
        map.on('error', () => {
          // A style or tile error must not blank the page.
          setState((current) => (current === 'ready' ? 'ready' : 'unavailable'));
        });
      })
      .catch(() => {
        if (!cancelled) setState('unavailable');
      });

    return () => {
      cancelled = true;
    };
    // The map is created once; later centre changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow the pin when the parent moves it (a new search result, typically).
  useEffect(() => {
    if (!center) return;
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    const current = marker.getLngLat();
    if (Math.abs(current.lat - center.lat) < 1e-7 && Math.abs(current.lng - center.lng) < 1e-7) {
      return;
    }
    marker.setLngLat([center.lng, center.lat]);
    map.easeTo({ center: [center.lng, center.lat], duration: 400 });
  }, [center]);

  // Release WebGL resources when checkout unmounts.
  useEffect(() => {
    return () => {
      try {
        mapRef.current?.remove();
      } catch {
        /* already gone */
      }
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  if (state === 'unavailable') {
    return (
      <div
        className={
          buttonClassName ??
          'flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-[11px] text-muted-foreground'
        }
      >
        <MapPin className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
        <span>
          Map preview is unavailable. Your address from search is still used, and you can add a
          landmark in the notes.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div
        ref={containerRef}
        role="application"
        aria-label={`${label}. Drag the pin, or tap the map, to move it.`}
        className="relative w-full overflow-hidden rounded-xl border border-border bg-muted"
        style={{ height }}
      />
      {state === 'loading' && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
          Loading map…
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Drag the pin to your exact gate. The fee is calculated from where the pin lands.
      </p>
    </div>
  );
}

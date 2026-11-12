'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, MapPin, Search, X } from 'lucide-react';
import type { LatLng } from '@/lib/delivery/types';

/**
 * Nigerian address search.
 *
 * Server-proxied (`/api/delivery/search`) so the `country=ng` restriction is
 * applied once, on the server, and the browser never talks to Mapbox directly
 * for geocoding.
 *
 * Keyboard behaviour follows the ARIA combobox pattern: arrow keys move the
 * highlight, Enter chooses, Escape closes. The results are buttons, so a touch
 * screen works without any of that.
 */

export type AddressResult = {
  id: string;
  name: string;
  placeName: string;
  lat: number;
  lng: number;
  context: string | null;
};

export function AddressSearch({
  onSelect,
  placeholder = 'Search a street, estate or landmark',
  proximity,
  autoFocus,
}: {
  onSelect: (result: AddressResult) => void;
  placeholder?: string;
  proximity?: LatLng | null;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AddressResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [configured, setConfigured] = useState(true);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query.trim() });
        if (proximity) {
          params.set('lat', String(proximity.lat));
          params.set('lng', String(proximity.lng));
        }
        const response = await fetch(`/api/delivery/search?${params.toString()}`);
        const data = await response.json();
        if (cancelled) return;
        setConfigured(data?.configured !== false);
        setResults(Array.isArray(data?.results) ? data.results : []);
        setOpen(true);
        setHighlight(-1);
        setError(null);
      } catch {
        if (!cancelled) setError('Search is unavailable right now.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, proximity?.lat, proximity?.lng]);

  // Close the dropdown on a click outside.
  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const choose = (result: AddressResult) => {
    onSelect(result);
    setQuery(result.placeName || result.name);
    setOpen(false);
    setHighlight(-1);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) {
      if (event.key === 'Enter') event.preventDefault();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((index) => (index <= 0 ? results.length - 1 : index - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const result = results[highlight >= 0 ? highlight : 0];
      if (result) choose(result);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setHighlight(-1);
    }
  };

  if (!configured) return null;

  return (
    <div ref={wrapperRef} className="relative">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search your delivery address
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id={`${listId}-input`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={highlight >= 0 ? `${listId}-option-${highlight}` : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-9 text-sm outline-none transition-colors focus:border-primary"
        />
        {loading && (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        )}
        {!loading && query.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
              setOpen(false);
            }}
            aria-label="Clear address search"
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      <p aria-live="polite" className="sr-only">
        {loading ? 'Searching addresses' : results.length > 0 ? `${results.length} addresses found` : ''}
      </p>

      {error && <p className="mt-1.5 text-[11px] text-destructive">{error}</p>}

      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching addresses"
          className="absolute z-30 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg"
        >
          {results.map((result, index) => (
            <li key={result.id} role="option" aria-selected={index === highlight} id={`${listId}-option-${index}`}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(index)}
                onClick={() => choose(result)}
                className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                  index === highlight ? 'bg-muted' : 'hover:bg-muted/60'
                }`}
              >
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{result.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{result.placeName}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && query.trim().length >= 3 && results.length === 0 && !error && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          No address matched. Try the street name, or type it below.
        </p>
      )}
    </div>
  );
}

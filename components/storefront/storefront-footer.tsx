'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Store, ArrowRight, Sparkles } from 'lucide-react';
import type { ColorConfig } from '@/lib/color-config';

interface PopularItem {
  name: string;
  restaurants?: number;
  total_orders?: number | string;
}

interface StorefrontFooterProps {
  colors: ColorConfig;
  /**
   * When true the footer is rendered inside a content area that already has
   * its own max-width / horizontal padding (e.g. the menu page main column).
   * Setting this avoids the inner container from creating a double max-width.
   */
  inContentColumn?: boolean;
}

const YEAR = new Date().getFullYear();

export function StorefrontFooter({
  colors,
  inContentColumn = false,
}: StorefrontFooterProps) {
  const [items, setItems] = useState<PopularItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/popular-items')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        if (!cancelled) setItems(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const accentTint = `${colors.accentColor}14`;
  const subtleBorder = `${colors.accentColor}1f`;

  return (
    <footer
      className="mt-12 border-t"
      style={{
        backgroundColor: colors.headerColor,
        borderColor: subtleBorder,
        color: colors.textColor,
      }}
    >
      <div
        className={`${
          inContentColumn ? 'w-full' : 'max-w-6xl mx-auto'
        } px-4 sm:px-6 py-8 sm:py-10`}
      >
        {/* Disclosure */}
        <p
          className="text-center md:text-left text-xs sm:text-sm leading-relaxed"
          style={{ color: colors.textColor, opacity: 0.7 }}
        >
          All prices listed on this page are set by the merchant.
        </p>

        {/* Restaurants near me */}
        <div className="mt-6 md:mt-8">
          <Link
            href="/restaurants/near-me"
            className="group inline-flex items-center gap-2 text-sm font-semibold rounded-full px-4 py-2 transition-colors"
            style={{
              backgroundColor: accentTint,
              color: colors.accentColor,
            }}
          >
            <MapPin className="w-4 h-4" />
            Restaurants near me
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Popular items across foodbase */}
        {items.length > 0 && (
          <div className="mt-6 md:mt-8">
            <div className="flex items-center gap-2 mb-3 justify-center md:justify-start">
              <Sparkles className="w-4 h-4" style={{ color: colors.accentColor }} />
              <h3
                className="text-xs sm:text-sm font-semibold uppercase tracking-wider"
                style={{ color: colors.textColor, opacity: 0.75 }}
              >
                Popular on FoodBase
              </h3>
            </div>
            <ul className="flex flex-wrap gap-2 justify-center md:justify-start">
              {items.map((it) => (
                <li key={it.name}>
                  <Link
                    href={`/restaurants/near-me?dish=${encodeURIComponent(it.name)}`}
                    className="inline-flex items-center text-xs sm:text-sm font-medium rounded-full px-3 py-1.5 border transition-colors"
                    style={{
                      borderColor: subtleBorder,
                      color: colors.textColor,
                    }}
                  >
                    {it.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Merchant / Agent CTAs */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <Link
            href="/?ref=merchant"
            className="rounded-2xl border p-5 flex items-start gap-3 transition-colors hover:bg-black/[0.02]"
            style={{ borderColor: subtleBorder }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: accentTint, color: colors.accentColor }}
            >
              <Store className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold" style={{ color: colors.textColor }}>
                FoodBase Merchant
              </p>
              <p
                className="text-xs sm:text-sm mt-1 leading-relaxed"
                style={{ color: colors.textColor, opacity: 0.7 }}
              >
                Get FoodBase for your restaurant.
              </p>
            </div>
            <ArrowRight
              className="w-4 h-4 flex-shrink-0 mt-1"
              style={{ color: colors.accentColor }}
            />
          </Link>

          <Link
            href="/?ref=agent"
            className="rounded-2xl border p-5 flex items-start gap-3 transition-colors hover:bg-black/[0.02]"
            style={{ borderColor: subtleBorder }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: accentTint, color: colors.accentColor }}
            >
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold" style={{ color: colors.textColor }}>
                FoodBase Agent
              </p>
              <p
                className="text-xs sm:text-sm mt-1 leading-relaxed"
                style={{ color: colors.textColor, opacity: 0.7 }}
              >
                Earn by onboarding restaurants near you.
              </p>
            </div>
            <ArrowRight
              className="w-4 h-4 flex-shrink-0 mt-1"
              style={{ color: colors.accentColor }}
            />
          </Link>
        </div>

        {/* Bottom strip: logo + links + copyright (one line on desktop) */}
        <div
          className="mt-8 pt-6 border-t flex flex-col items-center md:flex-row md:items-center md:justify-between gap-3 text-center md:text-left"
          style={{ borderColor: subtleBorder }}
        >
          <Link
            href="/"
            className="flex items-center gap-2"
            aria-label="FoodBase home"
          >
            <Image
              src="/foodbase-logo.png"
              alt="FoodBase"
              width={28}
              height={28}
              className="rounded-md"
            />
            <span
              className="text-sm font-bold tracking-tight"
              style={{ color: colors.textColor }}
            >
              FoodBase
            </span>
          </Link>

          <nav
            className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs sm:text-sm"
            style={{ color: colors.textColor, opacity: 0.7 }}
          >
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>
            <Link href="/privacy" className="hover:underline">
              Privacy
            </Link>
            <Link href="/about" className="hover:underline">
              About
            </Link>
            <span aria-hidden="true">·</span>
            <span>&copy; {YEAR} FoodBase.</span>
          </nav>
        </div>
      </div>
    </footer>
  );
}

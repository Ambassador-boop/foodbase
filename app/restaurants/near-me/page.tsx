import Link from 'next/link';
import Image from 'next/image';
import { MapPin, ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Restaurants near me · FoodBase',
  description:
    'Discover restaurants on FoodBase that are near you. Coming soon.',
};

export default function RestaurantsNearMePage() {
  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/"
            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-foreground"
            aria-label="Home"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Image
              src="/foodbase-logo.png"
              alt="FoodBase"
              width={28}
              height={28}
              className="rounded-md"
            />
            <span className="font-bold tracking-tight">FoodBase</span>
          </div>
        </div>
      </header>

      <section className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md text-center">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-primary/10 text-primary items-center justify-center mb-5">
            <MapPin className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-balance text-foreground">
            Restaurants near you
          </h1>
          <p className="mt-3 text-sm sm:text-base leading-relaxed text-muted-foreground">
            We&apos;re putting the finishing touches on a fully searchable map
            of every restaurant on FoodBase. Check back soon to discover
            kitchens around you, browse their menus and order in a few taps.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 mt-6 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold"
          >
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}

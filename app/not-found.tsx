'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* 404 Text */}
        <div className="mb-8">
          <h1 className="text-7xl md:text-8xl font-bold text-primary mb-2">404</h1>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Page Not Found</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            The page you're looking for doesn't exist. It might have been moved or deleted.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          <Link href="/">
            <Button className="w-full h-9 bg-primary text-white hover:bg-primary-dark text-sm font-medium flex items-center justify-center gap-2">
              <Home className="w-4 h-4" />
              Go Home
            </Button>
          </Link>
          <button
            onClick={() => window.history.back()}
            className="w-full h-9 border border-border rounded hover:bg-muted text-sm font-medium flex items-center justify-center gap-2 text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>

        {/* Additional Info */}
        <div className="mt-8 pt-8 border-t border-border">
          <p className="text-xs text-muted-foreground mb-4">
            Need help? Visit our homepage or contact support.
          </p>
          <Link href="/">
            <span className="text-xs text-primary hover:underline cursor-pointer">
              Back to FoodBase
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

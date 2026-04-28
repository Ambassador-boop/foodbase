"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

type Side = { name: string; logoUrl: string };

export default function BusinessSwitchOverlay() {
  const [active, setActive] = useState<{ from: Side; to: Side } | null>(null);

  useEffect(() => {
    function onSwitching(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.from?.logoUrl && detail?.to?.logoUrl) {
        setActive({ from: detail.from, to: detail.to });
      }
    }
    function onCancel() {
      setActive(null);
    }
    window.addEventListener("business:switching", onSwitching);
    window.addEventListener("business:switching:cancel", onCancel);
    return () => {
      window.removeEventListener("business:switching", onSwitching);
      window.removeEventListener("business:switching:cancel", onCancel);
    };
  }, []);

  if (!active) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={`Switching to ${active.to.name}`}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md mx-auto px-6 py-10 flex flex-col items-center gap-8">
        {/* Animation row */}
        <div className="relative flex items-center justify-center gap-6 sm:gap-10 w-full">
          {/* From logo */}
          <div className="flex flex-col items-center gap-3 animate-switch-out">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-white shadow-lg ring-2 ring-border">
              <Image
                src={active.from.logoUrl || "/placeholder.svg"}
                alt={active.from.name}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <p className="text-xs text-muted-foreground max-w-[100px] text-center truncate">
              {active.from.name}
            </p>
          </div>

          {/* Arrow */}
          <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-md animate-pulse-arrow">
            <ArrowRight className="w-5 h-5" />
          </div>

          {/* To logo */}
          <div className="flex flex-col items-center gap-3 animate-switch-in">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-white shadow-xl ring-2 ring-primary">
              <Image
                src={active.to.logoUrl || "/placeholder.svg"}
                alt={active.to.name}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <p className="text-xs font-semibold text-foreground max-w-[100px] text-center truncate">
              {active.to.name}
            </p>
          </div>
        </div>

        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-foreground">Switching workspace</p>
          <p className="text-xs text-muted-foreground">
            Loading {active.to.name}...
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-xs h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary animate-progress" />
        </div>
      </div>

      <style jsx>{`
        @keyframes switch-out {
          0% { opacity: 1; transform: translateX(0) scale(1); }
          60% { opacity: 0.4; transform: translateX(-8px) scale(0.95); }
          100% { opacity: 0.25; transform: translateX(-12px) scale(0.9); }
        }
        @keyframes switch-in {
          0% { opacity: 0; transform: translateX(20px) scale(0.85); }
          50% { opacity: 1; transform: translateX(0) scale(1.04); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes pulse-arrow {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        @keyframes progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        .animate-switch-out { animation: switch-out 1.4s ease-in-out forwards; }
        .animate-switch-in { animation: switch-in 1.2s 0.2s ease-out forwards; opacity: 0; }
        .animate-pulse-arrow { animation: pulse-arrow 1.2s ease-in-out infinite; }
        .animate-progress { animation: progress 1.5s ease-out forwards; }
      `}</style>
    </div>
  );
}

'use client';

import type { ColorConfig } from '@/lib/color-config';

interface CookingLoaderProps {
  colors: ColorConfig;
  /**
   * Optional message shown beneath the animation.
   * Pass an empty string to hide it.
   */
  message?: string;
}

/**
 * Pure-CSS "cooking pot" animation: a pot on a flame with three steam wisps
 * rising and a soft bubbling lid wobble. Uses inline keyframes (scoped via a
 * unique parent class) so the animation works without touching globals.css and
 * adapts to any restaurant theme via the `colors` prop.
 */
export function CookingLoader({
  colors,
  message = 'Preparing the menu',
}: CookingLoaderProps) {
  const accent = colors.accentColor;
  const text = colors.textColor;
  const bg = colors.backgroundColor;
  const potBody = colors.headerColor || '#1f2937';

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: bg }}
      role="status"
      aria-live="polite"
      aria-label="Loading menu"
    >
      <div className="cooking-loader relative">
        {/* Steam wisps */}
        <div className="steam steam-1" aria-hidden="true" />
        <div className="steam steam-2" aria-hidden="true" />
        <div className="steam steam-3" aria-hidden="true" />

        {/* Pot lid */}
        <div className="lid" aria-hidden="true">
          <div className="lid-knob" />
        </div>

        {/* Pot body */}
        <div className="pot" aria-hidden="true">
          <div className="pot-handle pot-handle-left" />
          <div className="pot-handle pot-handle-right" />
          <div className="pot-shine" />
        </div>

        {/* Flames */}
        <div className="flames" aria-hidden="true">
          <span className="flame flame-1" />
          <span className="flame flame-2" />
          <span className="flame flame-3" />
        </div>
      </div>

      {message ? (
        <p
          className="mt-8 text-sm font-medium tracking-wide"
          style={{ color: text, opacity: 0.75 }}
        >
          {message}
          <span className="dots" aria-hidden="true">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </p>
      ) : null}

      <style jsx>{`
        .cooking-loader {
          width: 140px;
          height: 160px;
          position: relative;
        }

        /* Steam */
        .steam {
          position: absolute;
          left: 50%;
          bottom: 92px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: ${accent};
          opacity: 0;
          filter: blur(4px);
          transform: translateX(-50%);
          animation: rise 2.4s ease-in-out infinite;
        }
        .steam-1 {
          margin-left: -22px;
          animation-delay: 0s;
        }
        .steam-2 {
          margin-left: 0;
          animation-delay: 0.4s;
        }
        .steam-3 {
          margin-left: 22px;
          animation-delay: 0.8s;
        }

        @keyframes rise {
          0% {
            opacity: 0;
            transform: translate(-50%, 0) scale(0.6);
          }
          25% {
            opacity: 0.55;
          }
          60% {
            opacity: 0.35;
            transform: translate(-50%, -36px) scale(1.1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -64px) scale(1.4);
          }
        }

        /* Lid */
        .lid {
          position: absolute;
          left: 50%;
          bottom: 84px;
          width: 110px;
          height: 14px;
          background: ${potBody};
          border-radius: 8px 8px 4px 4px;
          transform: translateX(-50%);
          transform-origin: 50% 100%;
          animation: wobble 1.4s ease-in-out infinite;
          box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.15);
        }
        .lid-knob {
          position: absolute;
          top: -8px;
          left: 50%;
          width: 10px;
          height: 10px;
          background: ${potBody};
          border-radius: 50%;
          transform: translateX(-50%);
        }
        @keyframes wobble {
          0%,
          100% {
            transform: translateX(-50%) rotate(-2deg);
          }
          50% {
            transform: translateX(-50%) rotate(2deg);
          }
        }

        /* Pot */
        .pot {
          position: absolute;
          left: 50%;
          bottom: 28px;
          width: 100px;
          height: 60px;
          background: ${potBody};
          border-radius: 4px 4px 14px 14px;
          transform: translateX(-50%);
          box-shadow: inset 0 -8px 0 rgba(0, 0, 0, 0.18);
        }
        .pot-handle {
          position: absolute;
          top: 14px;
          width: 12px;
          height: 18px;
          border: 4px solid ${potBody};
          border-radius: 6px;
        }
        .pot-handle-left {
          left: -14px;
          border-right: none;
        }
        .pot-handle-right {
          right: -14px;
          border-left: none;
        }
        .pot-shine {
          position: absolute;
          top: 8px;
          left: 12px;
          width: 6px;
          height: 28px;
          background: rgba(255, 255, 255, 0.18);
          border-radius: 3px;
        }

        /* Flames */
        .flames {
          position: absolute;
          left: 50%;
          bottom: 4px;
          width: 80px;
          height: 24px;
          transform: translateX(-50%);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 6px;
        }
        .flame {
          display: block;
          width: 14px;
          height: 22px;
          background: ${accent};
          border-radius: 50% 50% 20% 20% / 60% 60% 40% 40%;
          transform-origin: 50% 100%;
          animation: flicker 0.8s ease-in-out infinite;
          box-shadow: 0 0 10px ${accent}66;
        }
        .flame-1 {
          animation-delay: 0s;
          height: 18px;
        }
        .flame-2 {
          animation-delay: 0.2s;
          height: 24px;
        }
        .flame-3 {
          animation-delay: 0.4s;
          height: 18px;
        }
        @keyframes flicker {
          0%,
          100% {
            transform: scaleY(1) skewX(-2deg);
            opacity: 0.95;
          }
          50% {
            transform: scaleY(0.78) skewX(2deg);
            opacity: 1;
          }
        }

        /* Trailing dots in the message */
        .dots {
          display: inline-flex;
          margin-left: 2px;
        }
        .dots span {
          animation: blink 1.2s infinite;
        }
        .dots span:nth-child(2) {
          animation-delay: 0.2s;
        }
        .dots span:nth-child(3) {
          animation-delay: 0.4s;
        }
        @keyframes blink {
          0%,
          80%,
          100% {
            opacity: 0.2;
          }
          40% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

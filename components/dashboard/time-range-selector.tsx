'use client';

type TimeRange = 'today' | 'week' | 'month' | 'last30' | 'custom';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  showCustom?: boolean;
}

/**
 * Pill-style segmented control. Behaves like a radio group — single
 * active selection, full-width on mobile, compact on desktop.
 */
export default function TimeRangeSelector({
  value,
  onChange,
  showCustom = false,
}: TimeRangeSelectorProps) {
  const ranges: { label: string; short: string; value: TimeRange }[] = [
    { label: 'Today', short: 'Today', value: 'today' },
    { label: 'This Week', short: 'Week', value: 'week' },
    { label: 'This Month', short: 'Month', value: 'month' },
    { label: 'Last 30 Days', short: '30d', value: 'last30' },
  ];
  if (showCustom) ranges.push({ label: 'Custom', short: 'Custom', value: 'custom' });

  return (
    <div
      role="radiogroup"
      aria-label="Time range"
      className="inline-flex items-center gap-1 p-1 rounded-full bg-muted w-full sm:w-auto overflow-x-auto"
    >
      {ranges.map((range) => {
        const active = value === range.value;
        return (
          <button
            key={range.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(range.value)}
            className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-colors ${
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="sm:hidden">{range.short}</span>
            <span className="hidden sm:inline">{range.label}</span>
          </button>
        );
      })}
    </div>
  );
}

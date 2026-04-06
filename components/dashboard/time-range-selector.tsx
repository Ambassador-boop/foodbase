'use client';

import { Button } from '@/components/ui/button';

type TimeRange = 'today' | 'week' | 'month' | 'last30' | 'custom';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  showCustom?: boolean;
}

export default function TimeRangeSelector({ value, onChange, showCustom = false }: TimeRangeSelectorProps) {
  const ranges: { label: string; value: TimeRange }[] = [
    { label: 'Today', value: 'today' },
    { label: 'This Week', value: 'week' },
    { label: 'This Month', value: 'month' },
    { label: 'Last 30 Days', value: 'last30' },
  ];

  if (showCustom) {
    ranges.push({ label: 'Custom', value: 'custom' });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {ranges.map((range) => (
        <Button
          key={range.value}
          variant={value === range.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange(range.value)}
          className="text-xs"
        >
          {range.label}
        </Button>
      ))}
    </div>
  );
}

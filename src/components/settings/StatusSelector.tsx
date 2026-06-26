'use client';

import type { CSSProperties } from 'react';
import type { AvailabilityStatus } from '@/types';

export type DefaultStatus = AvailabilityStatus | 'none';

const OPTIONS: { value: DefaultStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'none', label: 'No default' },
];

const SELECTED_STYLE: Record<AvailabilityStatus, CSSProperties> = {
  available: { backgroundColor: 'var(--cal-available-bg)', color: 'var(--cal-available-text)' },
  unavailable: { backgroundColor: 'var(--cal-unavailable-bg)', color: 'var(--cal-unavailable-text)' },
  maybe: { backgroundColor: 'var(--cal-maybe-bg)', color: 'var(--cal-maybe-text)' },
};

interface StatusSelectorProps {
  value: DefaultStatus;
  onChange: (value: DefaultStatus) => void;
  dayLabel: string;
}

export function StatusSelector({ value, onChange, dayLabel }: StatusSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label={`${dayLabel} default status`}
      className="inline-flex flex-wrap gap-1 rounded-md border border-border bg-card p-0.5"
    >
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        const colorStyle =
          selected && opt.value !== 'none' ? SELECTED_STYLE[opt.value] : undefined;
        const stateClass = selected
          ? opt.value === 'none'
            ? 'bg-muted text-foreground'
            : ''
          : 'text-muted-foreground hover:text-foreground';
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            style={colorStyle}
            className={`rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${stateClass}`}
            data-testid={`status-${dayLabel.toLowerCase()}-${opt.value}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

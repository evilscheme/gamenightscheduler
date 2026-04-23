'use client';

export type PillState = 'available' | 'maybe' | 'unavailable' | 'unset';

interface StatePillProps {
  state: PillState;
  size?: 'sm' | 'md';
  className?: string;
}

const STATE_STYLES: Record<PillState, { cls: string; label: string }> = {
  available: { cls: 'bg-success/15 text-success border border-success/30', label: '✓ In' },
  maybe: { cls: 'bg-warning/15 text-warning border border-warning/30', label: '? Maybe' },
  unavailable: { cls: 'bg-danger/15 text-danger border border-danger/30', label: '✕ Out' },
  unset: { cls: 'bg-transparent text-muted-foreground border border-border', label: '· —' },
};

export function StatePill({ state, size = 'md', className = '' }: StatePillProps) {
  const { cls, label } = STATE_STYLES[state];
  const sizeCls = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${sizeCls} ${cls} ${className}`}>
      {label}
    </span>
  );
}

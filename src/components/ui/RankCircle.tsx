'use client';

interface RankCircleProps {
  rank: number;
  highlighted?: boolean;
  size?: 22 | 30;
  className?: string;
}

export function RankCircle({ rank, highlighted = false, size = 30, className = '' }: RankCircleProps) {
  const sizeCls = size === 30 ? 'h-[30px] w-[30px] text-[13px]' : 'h-[22px] w-[22px] text-[11px]';
  const colorCls = highlighted
    ? 'bg-primary text-primary-foreground ring-1 ring-primary/25'
    : 'bg-secondary text-secondary-foreground';
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-mono font-bold ${colorCls} ${sizeCls} ${className}`}
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </span>
  );
}

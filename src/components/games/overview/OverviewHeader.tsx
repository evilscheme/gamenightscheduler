'use client';

interface OverviewHeaderProps {
  monthRange: string;
  playerCount: number;
  scheduledCount: number;
}

export function OverviewHeader({
  monthRange,
  playerCount,
  scheduledCount,
}: OverviewHeaderProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Game overview</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {monthRange} · {playerCount} {playerCount === 1 ? 'player' : 'players'} · {scheduledCount}{' '}
          scheduled
        </p>
      </div>
    </div>
  );
}

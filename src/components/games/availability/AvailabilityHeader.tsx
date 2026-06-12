'use client';

interface AvailabilityHeaderProps {
  monthRange: string;
  answered: number;
  total: number;
  /** Hides the interaction hint and uses a neutral title (admin peek view). */
  readOnly?: boolean;
}

export function AvailabilityHeader({ monthRange, answered, total, readOnly = false }: AvailabilityHeaderProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          {readOnly ? 'Availability' : 'Mark your availability'}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {monthRange} · <span className="font-mono">{answered}/{total}</span>{' '}
          {total === 1 ? 'date' : 'dates'} answered
        </p>
        {!readOnly && (
          <p className="mt-1 text-[11px] italic text-muted-foreground">
            Click to cycle available → unavailable → maybe. Hover (or long-press on mobile) for
            notes and time constraints.
          </p>
        )}
      </div>
    </div>
  );
}

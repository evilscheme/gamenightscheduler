'use client';

import { describeDeletion, type DeletedGameHealth, type DeletionRecord } from '@/lib/admin';
import { ChartCard } from './chartUtils';

const HEALTH_STYLE: Record<DeletedGameHealth, { label: string; cls: string; title: string }> = {
  booked: { label: 'Booked', cls: 'bg-success/15 text-success', title: 'Had players and a session still to come' },
  active: { label: 'Active', cls: 'bg-primary/10 text-primary', title: 'Nothing booked, but active within the last week' },
  quiet: { label: 'Quiet', cls: 'bg-warning/15 text-warning', title: 'Nothing booked and quiet for 1–8 weeks' },
  dormant: { label: 'Dormant', cls: 'bg-muted text-muted-foreground', title: 'Nothing booked and quiet for 8+ weeks' },
};

const formatDay = (ts: string) =>
  new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * Every deliberate deletion in the range, with the facts its record kept. A
 * list of single lines rather than a chart: at a handful a week, each one is
 * worth reading on its own. A list, not an AdminTable: three columns leave the
 * facts a sliver at phone width, and scrolling sideways to read them is worse
 * than wrapping.
 */
export default function RecentDeletions({ records, total }: { records: DeletionRecord[]; total: number }) {
  const capped = total > records.length ? ` · showing the latest ${records.length} of ${total}` : '';
  return (
    <ChartCard
      title="Recent Deletions"
      subtitle={`What each deliberate delete removed. Records are anonymous: ages and counts, never names${capped}`}
    >
      <ul className="divide-y divide-border/60 text-sm">
        {records.length === 0 && (
          <li className="py-8 text-center text-muted-foreground">Nothing deleted in this range</li>
        )}
        {records.map((record) => (
          <li key={record.id} className="space-y-2 py-2.5">
            {describeDeletion(record).map((line, i) => (
              // One element per line, laid out by the grid: date and what share a
              // row with the facts beneath on a phone, all three abreast from sm up.
              <div
                key={i}
                data-testid="deletion-record"
                className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1 sm:grid-cols-[6.5rem_11rem_1fr]"
              >
                <span className="whitespace-nowrap text-muted-foreground">
                  {i === 0 ? formatDay(record.deletedAt) : null}
                </span>
                <span className={i === 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}>{line.what}</span>
                <span className="col-span-2 text-muted-foreground sm:col-span-1">
                  {line.health && (
                    <span
                      title={HEALTH_STYLE[line.health].title}
                      className={`mr-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${HEALTH_STYLE[line.health].cls}`}
                    >
                      {HEALTH_STYLE[line.health].label}
                    </span>
                  )}
                  {line.facts.join(' · ')}
                </span>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

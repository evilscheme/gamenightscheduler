'use client';

import { format, parseISO } from 'date-fns';
import type { User, MemberWithRole, GameSession } from '@/types';
import { useToast } from '@/components/ui';
import { generateICS } from '@/lib/ics';
import { splitUpcomingPast } from '@/lib/scheduleView';
import { OverviewHeader } from './OverviewHeader';
import { PartyPanel } from './PartyPanel';
import { GameDetailsPanel } from './GameDetailsPanel';
import { UpcomingSessionsCard } from './UpcomingSessionsCard';

export interface OverviewTabContentProps {
  // Header
  playDays: number[];
  windowStart: Date;
  windowEnd: Date;

  // Party panel
  allPlayers: (User | MemberWithRole)[];
  members: MemberWithRole[];
  gmId: string;
  isGm: boolean;
  isCoGm: boolean;
  completionByUserId: Map<string, { answered: number; total: number }>;
  inviteCode: string;
  onToggleCoGm: (playerId: string, makeCoGm: boolean) => Promise<void>;
  onRemovePlayer: (player: User) => void;

  // Details panel
  schedulingWindowMonths: number;
  defaultStartTime: string | null;
  defaultEndTime: string | null;
  timezone: string | null;
  minPlayersNeeded: number;
  confirmedSessions: GameSession[];
  use24h: boolean;
  adHocOnly: boolean;
  campaignStartDate: string | null;
  campaignEndDate: string | null;

  // Calendar actions on the upcoming-sessions card
  gameName: string;
  subscribeUrl: string;
}

function downloadICS(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function OverviewTabContent(props: OverviewTabContentProps) {
  const monthRange = `${format(props.windowStart, 'MMM')} – ${format(props.windowEnd, 'MMM yyyy')}`;
  const scheduledCount = props.confirmedSessions.length;
  const toast = useToast();

  const handleDownloadIcs = (session: GameSession) => {
    const ics = generateICS([
      {
        date: session.date,
        startTime: session.start_time || undefined,
        endTime: session.end_time || undefined,
        title: props.gameName,
        timezone: props.timezone || undefined,
      },
    ]);
    const slug = props.gameName.toLowerCase().replace(/\s+/g, '-');
    downloadICS(ics, `${slug}-${session.date}.ics`);
    toast.show(`Downloaded calendar file for ${format(parseISO(session.date), 'MMM d')}.`);
  };

  const handleDownloadAllIcs = () => {
    const confirmed = props.confirmedSessions.filter((s) => s.status === 'confirmed');
    const { upcoming } = splitUpcomingPast(confirmed, new Date());
    const ics = generateICS(
      upcoming.map((s) => ({
        date: s.date,
        startTime: s.start_time || undefined,
        endTime: s.end_time || undefined,
        title: props.gameName,
        timezone: props.timezone || undefined,
      }))
    );
    const slug = props.gameName.toLowerCase().replace(/\s+/g, '-');
    downloadICS(ics, `${slug}-sessions.ics`);
  };

  const handleCopySubscribe = async () => {
    try {
      await navigator.clipboard.writeText(props.subscribeUrl);
      toast.show('Subscribe URL copied to clipboard.');
    } catch {
      toast.show('Could not copy. Select the URL manually.', 'danger');
    }
  };

  return (
    <div className="space-y-5" data-testid="overview-tab-content">
      <OverviewHeader
        monthRange={monthRange}
        playerCount={props.allPlayers.length}
        scheduledCount={scheduledCount}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-5 min-w-0">
          <UpcomingSessionsCard
            sessions={props.confirmedSessions}
            use24h={props.use24h}
            subscribeUrl={props.subscribeUrl}
            onDownloadIcs={handleDownloadIcs}
            onDownloadAllIcs={handleDownloadAllIcs}
            onCopySubscribe={handleCopySubscribe}
          />
          <PartyPanel
            allPlayers={props.allPlayers}
            gmId={props.gmId}
            isGm={props.isGm}
            isCoGm={props.isCoGm}
            members={props.members}
            completionByUserId={props.completionByUserId}
            inviteCode={props.inviteCode}
            onToggleCoGm={props.onToggleCoGm}
            onRemovePlayer={props.onRemovePlayer}
          />
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <GameDetailsPanel
            playDays={props.playDays}
            schedulingWindowMonths={props.schedulingWindowMonths}
            defaultStartTime={props.defaultStartTime}
            defaultEndTime={props.defaultEndTime}
            timezone={props.timezone}
            minPlayersNeeded={props.minPlayersNeeded}
            inviteCode={props.inviteCode}
            use24h={props.use24h}
            adHocOnly={props.adHocOnly}
            campaignStartDate={props.campaignStartDate}
            campaignEndDate={props.campaignEndDate}
          />
        </aside>
      </div>
    </div>
  );
}

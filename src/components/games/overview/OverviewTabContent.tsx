'use client';

import { format, parseISO, startOfDay, isBefore } from 'date-fns';
import type { User, MemberWithRole, GameSession } from '@/types';
import { useToast } from '@/components/ui';
import { generateICS, slugifyGameName, triggerICSDownload } from '@/lib/ics';
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

export function OverviewTabContent(props: OverviewTabContentProps) {
  const monthRange = `${format(props.windowStart, 'MMM')} – ${format(props.windowEnd, 'MMM yyyy')}`;
  const scheduledCount = props.confirmedSessions.length;
  const toast = useToast();

  // Mirrors UpcomingSessionsCard's own visibility rule (it returns null when no
  // upcoming sessions). We need it here so the card's grid cell isn't reserved
  // when the card renders nothing.
  const overviewToday = startOfDay(new Date());
  const hasUpcoming = props.confirmedSessions.some(
    (s) => !isBefore(parseISO(s.date), overviewToday)
  );

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
    const slug = slugifyGameName(props.gameName);
    triggerICSDownload(ics, `${slug}-${session.date}.ics`);
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
    const slug = slugifyGameName(props.gameName);
    triggerICSDownload(ics, `${slug}-sessions.ics`);
  };

  const detailsPanel = (
    <GameDetailsPanel
      playDays={props.playDays}
      schedulingWindowMonths={props.schedulingWindowMonths}
      defaultStartTime={props.defaultStartTime}
      defaultEndTime={props.defaultEndTime}
      timezone={props.timezone}
      minPlayersNeeded={props.minPlayersNeeded}
      subscribeUrl={props.subscribeUrl}
      use24h={props.use24h}
      adHocOnly={props.adHocOnly}
      campaignStartDate={props.campaignStartDate}
      campaignEndDate={props.campaignEndDate}
    />
  );

  return (
    <div className="space-y-5" data-testid="overview-tab-content">
      <OverviewHeader
        monthRange={monthRange}
        playerCount={props.allPlayers.length}
        scheduledCount={scheduledCount}
      />

      {/*
        Flat grid so the three panels can be ordered independently per breakpoint.
        Mobile (single column): upcoming sessions → game details → players, so the
        info-dense details panel sits above the long player list.
        Desktop (2 columns): upcoming + players stack in column 1; game details is a
        sticky panel in column 2. Rendered ONCE — duplicating it broke unscoped
        getByText() assertions (two DOM matches) and read the content twice to AT.
      */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
        {hasUpcoming && (
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <UpcomingSessionsCard
              sessions={props.confirmedSessions}
              use24h={props.use24h}
              onDownloadIcs={handleDownloadIcs}
              onDownloadAllIcs={handleDownloadAllIcs}
            />
          </div>
        )}

        <div
          data-testid="game-details"
          className={`lg:col-start-2 lg:row-start-1 lg:sticky lg:top-20 ${
            hasUpcoming ? 'lg:row-span-2' : ''
          }`}
        >
          {detailsPanel}
        </div>

        <div
          className={`min-w-0 lg:col-start-1 ${
            hasUpcoming ? 'lg:row-start-2' : 'lg:row-start-1'
          }`}
        >
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
      </div>
    </div>
  );
}

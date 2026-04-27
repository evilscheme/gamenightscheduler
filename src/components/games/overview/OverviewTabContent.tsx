'use client';

import { format } from 'date-fns';
import type { User, MemberWithRole, GameSession } from '@/types';
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
}

export function OverviewTabContent(props: OverviewTabContentProps) {
  const monthRange = `${format(props.windowStart, 'MMM')} – ${format(props.windowEnd, 'MMM yyyy')}`;
  const scheduledCount = props.confirmedSessions.length;

  return (
    <div className="space-y-5" data-testid="overview-tab-content">
      <OverviewHeader
        monthRange={monthRange}
        playerCount={props.allPlayers.length}
        scheduledCount={scheduledCount}
      />

      <div className="space-y-5 lg:max-w-2xl">
        <UpcomingSessionsCard sessions={props.confirmedSessions} use24h={props.use24h} />
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
      </div>
    </div>
  );
}

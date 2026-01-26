"use client";

import { useState } from "react";
import { Button, Card, CardContent, CardHeader } from "@/components/ui";
import { GameSession } from "@/types";
import { DAY_LABELS, TIMEOUTS } from "@/lib/constants";
import { formatTime } from "@/lib/formatting";
import { format, parseISO, startOfDay, isBefore } from "date-fns";

interface GameDetailsCardProps {
  playDays: number[];
  schedulingWindowMonths: number;
  defaultStartTime: string | null;
  defaultEndTime: string | null;
  confirmedSessions: GameSession[];
  inviteCode: string;
}

export function GameDetailsCard({
  playDays,
  schedulingWindowMonths,
  defaultStartTime,
  defaultEndTime,
  confirmedSessions,
  inviteCode,
}: GameDetailsCardProps) {
  const [calendarCopied, setCalendarCopied] = useState(false);

  const copyCalendarUrl = () => {
    // Use webcal:// protocol for calendar subscription
    const webcalUrl = `webcal://${window.location.host}/api/games/calendar/${inviteCode}`;
    navigator.clipboard.writeText(webcalUrl);
    setCalendarCopied(true);
    setTimeout(() => setCalendarCopied(false), TIMEOUTS.NOTIFICATION);
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-card-foreground">
          Game Details
        </h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Play Days</p>
          <p className="text-card-foreground">
            {playDays.map((d) => DAY_LABELS.full[d]).join(", ")}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Scheduling Window</p>
          <p className="text-card-foreground">
            {schedulingWindowMonths} month(s) ahead
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Default Session Time</p>
          <p className="text-card-foreground">
            {formatTime(defaultStartTime)} - {formatTime(defaultEndTime)}
          </p>
        </div>
        {(() => {
          const today = startOfDay(new Date());
          const upcomingSessions = confirmedSessions.filter(
            (s) => !isBefore(parseISO(s.date), today)
          );
          return upcomingSessions.length > 0 ? (
            <div>
              <p className="text-sm text-muted-foreground">Upcoming Sessions</p>
              <ul className="mt-1 space-y-1">
                {upcomingSessions.slice(0, 3).map((s) => (
                  <li key={s.id} className="text-card-foreground">
                    {format(parseISO(s.date), "EEEE, MMMM d, yyyy")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null;
        })()}
        <div>
          <p className="text-sm text-muted-foreground">Calendar Subscription</p>
          <p className="text-xs text-muted-foreground mt-1 mb-2">
            Add this URL to your calendar app to auto-sync confirmed sessions
          </p>
          <Button
            onClick={copyCalendarUrl}
            variant="secondary"
            className="text-sm"
          >
            {calendarCopied ? "Copied!" : "Copy Calendar URL"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

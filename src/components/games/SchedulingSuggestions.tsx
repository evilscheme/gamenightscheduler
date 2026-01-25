'use client';

import { useState } from 'react';
import { format, parseISO, startOfDay, isBefore } from 'date-fns';
import { Button, Card, CardContent, CardHeader, EmptyState } from '@/components/ui';
import { DateSuggestion, GameSession } from '@/types';
import { generateICS } from '@/lib/ics';
import { DAY_LABELS, SESSION_DEFAULTS } from '@/lib/constants';
import { formatTime } from '@/lib/formatting';

interface SchedulingSuggestionsProps {
  suggestions: DateSuggestion[];
  sessions: GameSession[];
  isGm: boolean;
  gameName: string;
  defaultStartTime?: string | null;
  defaultEndTime?: string | null;
  onConfirm: (date: string, startTime: string, endTime: string) => Promise<{ success: boolean; error?: string }>;
  onCancel: (date: string) => void;
}

export function SchedulingSuggestions({
  suggestions,
  sessions,
  isGm,
  gameName,
  defaultStartTime,
  defaultEndTime,
  onConfirm,
  onCancel,
}: SchedulingSuggestionsProps) {
  // Use game's default times if set, otherwise fall back to SESSION_DEFAULTS
  const initialStartTime = defaultStartTime?.slice(0, 5) || SESSION_DEFAULTS.START_TIME;
  const initialEndTime = defaultEndTime?.slice(0, 5) || SESSION_DEFAULTS.END_TIME;

  const [showAll, setShowAll] = useState(false);
  const [showPastSessions, setShowPastSessions] = useState(false);
  const [confirmingDate, setConfirmingDate] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<string>(initialStartTime);
  const [endTime, setEndTime] = useState<string>(initialEndTime);
  const [isConfirming, setIsConfirming] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const confirmedDates = new Set(sessions.filter((s) => s.status === 'confirmed').map((s) => s.date));
  const confirmedSessions = sessions.filter((s) => s.status === 'confirmed');

  // Split sessions into upcoming and past
  const today = startOfDay(new Date());
  const upcomingSessions = confirmedSessions.filter(
    (s) => !isBefore(parseISO(s.date), today)
  );
  const pastSessions = confirmedSessions.filter(
    (s) => isBefore(parseISO(s.date), today)
  );

  const handleConfirmClick = (date: string) => {
    // Reset to defaults each time the modal opens
    setStartTime(initialStartTime);
    setEndTime(initialEndTime);
    setLocalError(null);
    setConfirmingDate(date);
  };

  const handleConfirmSubmit = async () => {
    if (confirmingDate) {
      setIsConfirming(true);
      setLocalError(null);
      const result = await onConfirm(confirmingDate, startTime, endTime);
      setIsConfirming(false);
      if (result.success) {
        setConfirmingDate(null);
      } else if (result.error) {
        setLocalError(result.error);
      }
    }
  };

  const displayedSuggestions = showAll ? suggestions : suggestions.slice(0, 10);

  const handleExportAll = () => {
    const events = upcomingSessions.map((session) => ({
      date: session.date,
      startTime: session.start_time || undefined,
      endTime: session.end_time || undefined,
      title: gameName,
    }));
    const ics = generateICS(events);
    downloadICS(ics, `${gameName.toLowerCase().replace(/\s+/g, '-')}-sessions.ics`);
  };

  const handleExportSingle = (session: GameSession) => {
    const ics = generateICS([{
      date: session.date,
      startTime: session.start_time || undefined,
      endTime: session.end_time || undefined,
      title: gameName,
    }]);
    downloadICS(ics, `${gameName.toLowerCase().replace(/\s+/g, '-')}-${session.date}.ics`);
  };

  const downloadICS = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Upcoming Sessions */}
      {upcomingSessions.length > 0 && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-card-foreground">Upcoming Sessions</h2>
            <Button size="sm" variant="secondary" onClick={handleExportAll} className="w-full sm:w-auto">
              📅 Export All to Calendar
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {upcomingSessions.map((session) => {
                const suggestion = suggestions.find((s) => s.date === session.date);
                const availablePercent = suggestion
                  ? Math.round((suggestion.availableCount / suggestion.totalPlayers) * 100)
                  : 0;
                const maybePercent = suggestion
                  ? Math.round((suggestion.maybeCount / suggestion.totalPlayers) * 100)
                  : 0;
                const unavailablePercent = suggestion
                  ? Math.round((suggestion.unavailableCount / suggestion.totalPlayers) * 100)
                  : 0;
                const pendingPercent = suggestion
                  ? Math.round((suggestion.pendingCount / suggestion.totalPlayers) * 100)
                  : 0;

                return (
                  <li key={session.id} className="py-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="text-2xl shrink-0">🎲</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-card-foreground">
                            {format(parseISO(session.date), 'EEEE, MMMM d, yyyy')}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {session.start_time && session.end_time
                              ? `${formatTime(session.start_time)} - ${formatTime(session.end_time)}`
                              : DAY_LABELS.full[parseISO(session.date).getDay()]}
                          </p>
                          {suggestion && (
                            <>
                              {/* Segmented progress bar */}
                              <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden flex">
                                  {availablePercent > 0 && (
                                    <div
                                      className="h-2.5 bg-green-500"
                                      style={{ width: `${availablePercent}%` }}
                                    />
                                  )}
                                  {maybePercent > 0 && (
                                    <div
                                      className="h-2.5 bg-yellow-500"
                                      style={{ width: `${maybePercent}%` }}
                                    />
                                  )}
                                  {unavailablePercent > 0 && (
                                    <div
                                      className="h-2.5 bg-red-500"
                                      style={{ width: `${unavailablePercent}%` }}
                                    />
                                  )}
                                  {pendingPercent > 0 && (
                                    <div
                                      className="h-2.5 bg-slate-400 dark:bg-slate-500"
                                      style={{ width: `${pendingPercent}%` }}
                                    />
                                  )}
                                </div>
                              </div>
                              {/* Status counts */}
                              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                                <span className="text-success">
                                  {suggestion.availableCount} available
                                </span>
                                <span className="text-warning">
                                  {suggestion.maybeCount} maybe
                                </span>
                                <span className="text-danger">
                                  {suggestion.unavailableCount} unavailable
                                </span>
                                <span className="text-slate-500 dark:text-slate-400">
                                  {suggestion.pendingCount} pending
                                </span>
                              </div>
                              {/* Player details */}
                              <div className="mt-2 text-sm space-y-1">
                                {suggestion.availablePlayers.length > 0 && (
                                  <p className="text-muted-foreground">
                                    <span className="text-success">Available:</span>{' '}
                                    {suggestion.availablePlayers.map((p) =>
                                      p.comment ? `${p.user.name} (${p.comment})` : p.user.name
                                    ).join(', ')}
                                  </p>
                                )}
                                {suggestion.maybePlayers.length > 0 && (
                                  <p className="text-muted-foreground">
                                    <span className="text-warning">Maybe:</span>{' '}
                                    {suggestion.maybePlayers.map((p) =>
                                      p.comment ? `${p.user.name} (${p.comment})` : p.user.name
                                    ).join(', ')}
                                  </p>
                                )}
                                {suggestion.unavailablePlayers.length > 0 && (
                                  <p className="text-muted-foreground">
                                    <span className="text-danger">Unavailable:</span>{' '}
                                    {suggestion.unavailablePlayers.map((p) =>
                                      p.comment ? `${p.user.name} (${p.comment})` : p.user.name
                                    ).join(', ')}
                                  </p>
                                )}
                                {suggestion.pendingPlayers.length > 0 && (
                                  <p className="text-muted-foreground">
                                    <span className="text-slate-500 dark:text-slate-400">Pending:</span>{' '}
                                    {suggestion.pendingPlayers.map((p) => p.name).join(', ')}
                                  </p>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0 sm:ml-4">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleExportSingle(session)}
                        >
                          📅 Add to Calendar
                        </Button>
                        {isGm && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => onCancel(session.date)}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Past Sessions */}
      {pastSessions.length > 0 && (
        <Card>
          <CardHeader>
            <button
              onClick={() => setShowPastSessions(!showPastSessions)}
              className="flex items-center justify-between w-full text-left"
            >
              <h2 className="text-lg font-semibold text-muted-foreground">
                Past Sessions ({pastSessions.length})
              </h2>
              <span className="text-muted-foreground">
                {showPastSessions ? '▲' : '▼'}
              </span>
            </button>
          </CardHeader>
          {showPastSessions && (
            <CardContent>
              <ul className="divide-y divide-border">
                {pastSessions.map((session) => {
                  const suggestion = suggestions.find((s) => s.date === session.date);

                  return (
                    <li key={session.id} className="py-3 opacity-70">
                      <div className="flex items-start gap-3">
                        <span className="text-xl shrink-0 grayscale">🎲</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-muted-foreground">
                            {format(parseISO(session.date), 'EEEE, MMMM d, yyyy')}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {session.start_time && session.end_time
                              ? `${formatTime(session.start_time)} - ${formatTime(session.end_time)}`
                              : DAY_LABELS.full[parseISO(session.date).getDay()]}
                          </p>
                          {suggestion && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {suggestion.availableCount} attended, {suggestion.maybeCount} maybe, {suggestion.unavailableCount} unavailable
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          )}
        </Card>
      )}

      {/* Suggestions */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-card-foreground">Date Suggestions</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Ranked by player availability. {isGm ? 'Click confirm to schedule a session.' : 'Ask your GM to confirm dates.'}
          </p>
        </CardHeader>
        <CardContent>
          {suggestions.length === 0 ? (
            <EmptyState
              title="No available dates"
              description="No available dates in the scheduling window."
            />
          ) : (
            <>
              <ul className="divide-y divide-border">
                {displayedSuggestions.map((suggestion) => {
                  const isConfirmed = confirmedDates.has(suggestion.date);
                  const availablePercent = Math.round(
                    (suggestion.availableCount / suggestion.totalPlayers) * 100
                  );
                  const maybePercent = Math.round(
                    (suggestion.maybeCount / suggestion.totalPlayers) * 100
                  );
                  const unavailablePercent = Math.round(
                    (suggestion.unavailableCount / suggestion.totalPlayers) * 100
                  );
                  const pendingPercent = Math.round(
                    (suggestion.pendingCount / suggestion.totalPlayers) * 100
                  );

                  return (
                    <li
                      key={suggestion.date}
                      className={`py-4 -mx-4 px-4 rounded-lg ${
                        isConfirmed
                          ? 'bg-green-500/10 dark:bg-green-500/15'
                          : ''
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <p className="font-medium text-card-foreground">
                              {format(parseISO(suggestion.date), 'EEEE, MMMM d')}
                            </p>
                            {isConfirmed && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-success/20 text-success rounded">
                                Confirmed
                              </span>
                            )}
                          </div>
                          {/* Segmented progress bar */}
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 sm:max-w-xs bg-muted rounded-full h-2.5 overflow-hidden flex">
                              {availablePercent > 0 && (
                                <div
                                  className="h-2.5 bg-green-500"
                                  style={{ width: `${availablePercent}%` }}
                                />
                              )}
                              {maybePercent > 0 && (
                                <div
                                  className="h-2.5 bg-yellow-500"
                                  style={{ width: `${maybePercent}%` }}
                                />
                              )}
                              {unavailablePercent > 0 && (
                                <div
                                  className="h-2.5 bg-red-500"
                                  style={{ width: `${unavailablePercent}%` }}
                                />
                              )}
                              {pendingPercent > 0 && (
                                <div
                                  className="h-2.5 bg-slate-400 dark:bg-slate-500"
                                  style={{ width: `${pendingPercent}%` }}
                                />
                              )}
                            </div>
                          </div>
                          {/* Status counts */}
                          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                            <span className="text-success">
                              {suggestion.availableCount} available
                            </span>
                            <span className="text-warning">
                              {suggestion.maybeCount} maybe
                            </span>
                            <span className="text-danger">
                              {suggestion.unavailableCount} unavailable
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">
                              {suggestion.pendingCount} pending
                            </span>
                          </div>
                          {/* Player details */}
                          <div className="mt-2 text-sm space-y-1">
                            {suggestion.availablePlayers.length > 0 && (
                              <p className="text-muted-foreground">
                                <span className="text-success">Available:</span>{' '}
                                {suggestion.availablePlayers.map((p) =>
                                  p.comment ? `${p.user.name} (${p.comment})` : p.user.name
                                ).join(', ')}
                              </p>
                            )}
                            {suggestion.maybePlayers.length > 0 && (
                              <p className="text-muted-foreground">
                                <span className="text-warning">Maybe:</span>{' '}
                                {suggestion.maybePlayers.map((p) =>
                                  p.comment ? `${p.user.name} (${p.comment})` : p.user.name
                                ).join(', ')}
                              </p>
                            )}
                            {suggestion.unavailablePlayers.length > 0 && (
                              <p className="text-muted-foreground">
                                <span className="text-danger">Unavailable:</span>{' '}
                                {suggestion.unavailablePlayers.map((p) =>
                                  p.comment ? `${p.user.name} (${p.comment})` : p.user.name
                                ).join(', ')}
                              </p>
                            )}
                            {suggestion.pendingPlayers.length > 0 && (
                              <p className="text-muted-foreground">
                                <span className="text-slate-500 dark:text-slate-400">Pending:</span>{' '}
                                {suggestion.pendingPlayers.map((p) => p.name).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                        {isGm && !isConfirmed && (
                          <Button
                            size="sm"
                            onClick={() => handleConfirmClick(suggestion.date)}
                            className="shrink-0 self-start"
                          >
                            Confirm
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {suggestions.length > 10 && (
                <div className="mt-4 text-center">
                  <Button variant="ghost" onClick={() => setShowAll(!showAll)}>
                    {showAll ? 'Show Less' : `Show All (${suggestions.length} dates)`}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Time picker modal */}
      {confirmingDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-card-foreground mb-4">
              Schedule Session
            </h3>
            <p className="text-muted-foreground mb-4">
              {format(parseISO(confirmingDate), 'EEEE, MMMM d, yyyy')}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {localError && (
              <p className="text-sm text-danger mt-4">{localError}</p>
            )}

            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setConfirmingDate(null)}
                disabled={isConfirming}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirmSubmit}
                disabled={isConfirming}
              >
                {isConfirming ? 'Confirming...' : 'Confirm Session'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

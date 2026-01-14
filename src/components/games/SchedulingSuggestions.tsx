'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Button, Card, CardContent, CardHeader, EmptyState } from '@/components/ui';
import { DateSuggestion, GameSession } from '@/types';
import { generateICS } from '@/lib/ics';
import { DAY_LABELS, SESSION_DEFAULTS } from '@/lib/constants';

interface SchedulingSuggestionsProps {
  suggestions: DateSuggestion[];
  sessions: GameSession[];
  isGm: boolean;
  gameName: string;
  onConfirm: (date: string, startTime: string, endTime: string) => void;
  onCancel: (date: string) => void;
}

export function SchedulingSuggestions({
  suggestions,
  sessions,
  isGm,
  gameName,
  onConfirm,
  onCancel,
}: SchedulingSuggestionsProps) {
  const [showAll, setShowAll] = useState(false);
  const [confirmingDate, setConfirmingDate] = useState<string | null>(null);
  const [startTime, setStartTime] = useState(SESSION_DEFAULTS.START_TIME);
  const [endTime, setEndTime] = useState(SESSION_DEFAULTS.END_TIME);

  const confirmedDates = new Set(sessions.filter((s) => s.status === 'confirmed').map((s) => s.date));
  const confirmedSessions = sessions.filter((s) => s.status === 'confirmed');

  const handleConfirmClick = (date: string) => {
    setConfirmingDate(date);
  };

  const handleConfirmSubmit = () => {
    if (confirmingDate) {
      onConfirm(confirmingDate, startTime, endTime);
      setConfirmingDate(null);
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const displayedSuggestions = showAll ? suggestions : suggestions.slice(0, 10);

  const handleExportAll = () => {
    const events = confirmedSessions.map((session) => ({
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
      {/* Confirmed Sessions */}
      {confirmedSessions.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <h2 className="text-lg font-semibold text-card-foreground">Confirmed Sessions</h2>
            <Button size="sm" variant="secondary" onClick={handleExportAll}>
              Export All (.ics)
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {confirmedSessions.map((session) => {
                const suggestion = suggestions.find((s) => s.date === session.date);
                const availablePercent = suggestion
                  ? Math.round((suggestion.availableCount / suggestion.totalPlayers) * 100)
                  : 0;
                const unavailablePercent = suggestion
                  ? Math.round((suggestion.unavailableCount / suggestion.totalPlayers) * 100)
                  : 0;
                const pendingPercent = suggestion
                  ? Math.round((suggestion.pendingCount / suggestion.totalPlayers) * 100)
                  : 0;

                return (
                  <li key={session.id} className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <span className="text-2xl">🎲</span>
                        <div className="flex-1">
                          <p className="font-medium text-card-foreground">
                            {format(new Date(session.date), 'EEEE, MMMM d, yyyy')}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {session.start_time && session.end_time
                              ? `${formatTime(session.start_time)} - ${formatTime(session.end_time)}`
                              : DAY_LABELS.full[new Date(session.date).getDay()]}
                          </p>
                          {suggestion && (
                            <>
                              {/* Segmented progress bar */}
                              <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 max-w-xs bg-muted rounded-full h-2.5 overflow-hidden flex">
                                  {availablePercent > 0 && (
                                    <div
                                      className="h-2.5 bg-green-500"
                                      style={{ width: `${availablePercent}%` }}
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
                                      className="h-2.5 bg-muted-foreground/50"
                                      style={{ width: `${pendingPercent}%` }}
                                    />
                                  )}
                                </div>
                              </div>
                              {/* Status counts */}
                              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                                <span className="text-green-600 dark:text-green-400">
                                  {suggestion.availableCount} available
                                </span>
                                <span className="text-red-600 dark:text-red-400">
                                  {suggestion.unavailableCount} unavailable
                                </span>
                                <span className="text-muted-foreground">
                                  {suggestion.pendingCount} pending
                                </span>
                              </div>
                              {/* Player details */}
                              <div className="mt-2 text-sm space-y-1">
                                {suggestion.availablePlayers.length > 0 && (
                                  <p className="text-muted-foreground">
                                    <span className="text-green-600 dark:text-green-400">Available:</span>{' '}
                                    {suggestion.availablePlayers.map((p) => p.name).join(', ')}
                                  </p>
                                )}
                                {suggestion.unavailablePlayers.length > 0 && (
                                  <p className="text-muted-foreground">
                                    <span className="text-red-600 dark:text-red-400">Unavailable:</span>{' '}
                                    {suggestion.unavailablePlayers.map((p) => p.name).join(', ')}
                                  </p>
                                )}
                                {suggestion.pendingPlayers.length > 0 && (
                                  <p className="text-muted-foreground">
                                    <span className="text-muted-foreground">Pending:</span>{' '}
                                    {suggestion.pendingPlayers.map((p) => p.name).join(', ')}
                                  </p>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleExportSingle(session)}
                        >
                          Export
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
                  const unavailablePercent = Math.round(
                    (suggestion.unavailableCount / suggestion.totalPlayers) * 100
                  );
                  const pendingPercent = Math.round(
                    (suggestion.pendingCount / suggestion.totalPlayers) * 100
                  );

                  return (
                    <li key={suggestion.date} className="py-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <p className="font-medium text-card-foreground">
                              {format(new Date(suggestion.date), 'EEEE, MMMM d')}
                            </p>
                            {isConfirmed && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-700 dark:text-green-400 rounded">
                                Confirmed
                              </span>
                            )}
                          </div>
                          {/* Segmented progress bar */}
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 max-w-xs bg-muted rounded-full h-2.5 overflow-hidden flex">
                              {availablePercent > 0 && (
                                <div
                                  className="h-2.5 bg-green-500"
                                  style={{ width: `${availablePercent}%` }}
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
                                  className="h-2.5 bg-muted-foreground/50"
                                  style={{ width: `${pendingPercent}%` }}
                                />
                              )}
                            </div>
                          </div>
                          {/* Status counts */}
                          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                            <span className="text-green-600 dark:text-green-400">
                              {suggestion.availableCount} available
                            </span>
                            <span className="text-red-600 dark:text-red-400">
                              {suggestion.unavailableCount} unavailable
                            </span>
                            <span className="text-muted-foreground">
                              {suggestion.pendingCount} pending
                            </span>
                          </div>
                          {/* Player details */}
                          <div className="mt-2 text-sm space-y-1">
                            {suggestion.availablePlayers.length > 0 && (
                              <p className="text-muted-foreground">
                                <span className="text-green-600 dark:text-green-400">Available:</span>{' '}
                                {suggestion.availablePlayers.map((p) => p.name).join(', ')}
                              </p>
                            )}
                            {suggestion.unavailablePlayers.length > 0 && (
                              <p className="text-muted-foreground">
                                <span className="text-red-600 dark:text-red-400">Unavailable:</span>{' '}
                                {suggestion.unavailablePlayers.map((p) => p.name).join(', ')}
                              </p>
                            )}
                            {suggestion.pendingPlayers.length > 0 && (
                              <p className="text-muted-foreground">
                                <span className="text-muted-foreground">Pending:</span>{' '}
                                {suggestion.pendingPlayers.map((p) => p.name).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                        {isGm && !isConfirmed && (
                          <Button
                            size="sm"
                            onClick={() => handleConfirmClick(suggestion.date)}
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
              {format(new Date(confirmingDate), 'EEEE, MMMM d, yyyy')}
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

            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setConfirmingDate(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirmSubmit}
              >
                Confirm Session
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

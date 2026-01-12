'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Button, Card, CardContent, CardHeader } from '@/components/ui';
import { DateSuggestion, GameSession } from '@/types';
import { generateICS } from '@/lib/ics';

interface SchedulingSuggestionsProps {
  suggestions: DateSuggestion[];
  sessions: GameSession[];
  isGm: boolean;
  onConfirm: (date: string) => void;
  onCancel: (date: string) => void;
  gameId: string;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function SchedulingSuggestions({
  suggestions,
  sessions,
  isGm,
  onConfirm,
  onCancel,
  gameId,
}: SchedulingSuggestionsProps) {
  const [showAll, setShowAll] = useState(false);

  const confirmedDates = new Set(sessions.filter((s) => s.status === 'confirmed').map((s) => s.date));
  const confirmedSessions = sessions.filter((s) => s.status === 'confirmed');

  const displayedSuggestions = showAll ? suggestions : suggestions.slice(0, 10);

  const handleExportAll = () => {
    const events = confirmedSessions.map((session) => ({
      date: session.date,
      title: 'Game Night',
    }));
    const ics = generateICS(events);
    downloadICS(ics, 'game-sessions.ics');
  };

  const handleExportSingle = (date: string) => {
    const ics = generateICS([{ date, title: 'Game Night' }]);
    downloadICS(ics, `game-session-${date}.ics`);
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
            <h2 className="text-lg font-semibold">Confirmed Sessions</h2>
            <Button size="sm" variant="secondary" onClick={handleExportAll}>
              Export All (.ics)
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-gray-100">
              {confirmedSessions.map((session) => (
                <li
                  key={session.id}
                  className="py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🎲</span>
                    <div>
                      <p className="font-medium text-gray-900">
                        {format(new Date(session.date), 'EEEE, MMMM d, yyyy')}
                      </p>
                      <p className="text-sm text-gray-500">
                        {DAYS[new Date(session.date).getDay()]}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleExportSingle(session.date)}
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
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Suggestions */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Date Suggestions</h2>
          <p className="text-sm text-gray-500 mt-1">
            Ranked by player availability. {isGm ? 'Click confirm to schedule a session.' : 'Ask your GM to confirm dates.'}
          </p>
        </CardHeader>
        <CardContent>
          {suggestions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No available dates in the scheduling window.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-gray-100">
                {displayedSuggestions.map((suggestion) => {
                  const isConfirmed = confirmedDates.has(suggestion.date);
                  const percentage = Math.round(
                    (suggestion.availableCount / suggestion.totalPlayers) * 100
                  );

                  return (
                    <li key={suggestion.date} className="py-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <p className="font-medium text-gray-900">
                              {format(new Date(suggestion.date), 'EEEE, MMMM d')}
                            </p>
                            {isConfirmed && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                                Confirmed
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="flex-1 max-w-xs bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  percentage === 100
                                    ? 'bg-green-500'
                                    : percentage >= 75
                                    ? 'bg-lime-500'
                                    : percentage >= 50
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                                }`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">
                              {suggestion.availableCount}/{suggestion.totalPlayers} available
                            </span>
                          </div>
                          <div className="mt-2 text-sm">
                            {suggestion.unavailablePlayers.length > 0 && (
                              <p className="text-gray-500">
                                Unavailable:{' '}
                                {suggestion.unavailablePlayers.map((p) => p.name).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                        {isGm && !isConfirmed && (
                          <Button
                            size="sm"
                            onClick={() => onConfirm(suggestion.date)}
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
    </div>
  );
}

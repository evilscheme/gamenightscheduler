'use client';

import { format, parseISO } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { Modal, Button, EyebrowLabel } from '@/components/ui';
import { TEXT_LIMITS } from '@/lib/constants';
import { getTimeOptions } from '@/lib/timeOptions';
import {
  formatSessionTimeWindow,
  type OtherGameSessionInfo,
} from '@/lib/schedule';

// Extracted component to avoid IIFE in JSX (Turbopack compatibility)
interface NoteEditorPopoverProps {
  commentingDate: string;
  hasAvailability: boolean;
  showTimeFields: boolean;
  commentText: string;
  availableAfterText: string;
  availableUntilText: string;
  onCommentChange: (value: string) => void;
  onAvailableAfterChange: (value: string) => void;
  onAvailableUntilChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  use24h: boolean;
  gmNote?: string | null;
  showGmNote?: boolean;
  isGmOrCoGm?: boolean;
  gmNoteText?: string;
  onGmNoteChange?: (value: string) => void;
  otherGameSessions?: OtherGameSessionInfo[];
}

export function NoteEditorPopover({
  commentingDate,
  hasAvailability,
  showTimeFields,
  commentText,
  availableAfterText,
  availableUntilText,
  onCommentChange,
  onAvailableAfterChange,
  onAvailableUntilChange,
  onSave,
  onCancel,
  use24h,
  gmNote,
  showGmNote,
  isGmOrCoGm,
  gmNoteText,
  onGmNoteChange,
  otherGameSessions,
}: NoteEditorPopoverProps) {
  const timeOptions = getTimeOptions(use24h);
  return (
    <Modal
      open
      onClose={onCancel}
      title={format(parseISO(commentingDate), 'MMM d')}
      footer={
        hasAvailability || isGmOrCoGm ? (
          <div className="flex gap-2 w-full">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button size="sm" className="flex-1" onClick={onSave}>
              Save
            </Button>
          </div>
        ) : (
          <Button size="sm" className="w-full" onClick={onCancel}>
            OK
          </Button>
        )
      }
    >
      {/* Scheduled elsewhere — confirmed sessions you have in other games that
          night. Matches the calendar's accent badge so the two read as one idea. */}
      {otherGameSessions && otherGameSessions.length > 0 && (
        <div>
          <EyebrowLabel variant="muted" className="block mb-2">Scheduled elsewhere</EyebrowLabel>
          <div className="rounded-md border border-accent/30 bg-accent/10 p-3 space-y-1.5">
            {otherGameSessions.map((os) => {
              const when = formatSessionTimeWindow(os.startTime, os.endTime, use24h);
              return (
                <div key={os.gameId} className="flex items-start gap-2 text-sm" data-testid="popover-other-game">
                  <CalendarDays className="size-3.5 mt-0.5 shrink-0 text-accent-foreground" />
                  <span className="text-foreground">
                    <span className="font-medium">{os.gameName}</span>
                    {when && <span className="text-muted-foreground"> · {when}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* GM Note section */}
      {showGmNote && (
        <div>
          <EyebrowLabel variant="muted" className="block mb-2">GM Note</EyebrowLabel>
          <div className="bg-secondary/50 rounded-md p-3">
            {isGmOrCoGm ? (
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Visible to all players
                </label>
                <input
                  type="text"
                  value={gmNoteText || ""}
                  onChange={(e) => onGmNoteChange?.(e.target.value)}
                  placeholder="e.g., Only after 2pm, different location"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  maxLength={TEXT_LIMITS.PLAY_DATE_NOTE}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSave();
                    if (e.key === "Escape") onCancel();
                  }}
                />
              </div>
            ) : gmNote ? (
              <p className="text-sm text-foreground">
                {gmNote}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {/* Your Availability section — only when user has set availability */}
      {hasAvailability && (
        <div>
          <EyebrowLabel variant="muted" className="block mb-2">Your Availability</EyebrowLabel>
          <div className="space-y-3">
            {showTimeFields && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="available-after" className="block text-xs text-muted-foreground mb-1">
                    Available after
                  </label>
                  <select
                    id="available-after"
                    value={availableAfterText}
                    onChange={(e) => onAvailableAfterChange(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">—</option>
                    {timeOptions.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="available-until" className="block text-xs text-muted-foreground mb-1">
                    Available until
                  </label>
                  <select
                    id="available-until"
                    value={availableUntilText}
                    onChange={(e) => onAvailableUntilChange(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">—</option>
                    {timeOptions.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <div>
              <label htmlFor="availability-note" className="block text-xs text-muted-foreground mb-1">
                Note
              </label>
              <input
                id="availability-note"
                type="text"
                value={commentText}
                onChange={(e) => onCommentChange(e.target.value)}
                placeholder="e.g., Depends on work schedule"
                maxLength={TEXT_LIMITS.AVAILABILITY_COMMENT}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSave();
                  if (e.key === "Escape") onCancel();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

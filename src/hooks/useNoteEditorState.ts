'use client';

import { useState } from 'react';
import type { AvailabilityEntry } from '@/lib/availability';
import type { AvailabilityStatus } from '@/types';

interface UseNoteEditorStateArgs {
  readOnly: boolean;
  availability: Record<string, AvailabilityEntry>;
  playDateNotes: Map<string, string>;
  onToggle: (
    date: string,
    status: AvailabilityStatus,
    comment: string | null,
    availableAfter: string | null,
    availableUntil: string | null
  ) => void;
  onUpdatePlayDateNote?: (date: string, note: string | null) => void;
}

/**
 * Local state + handlers for the note/time-constraint editor popover opened by
 * clicking a day's edit icon or long-pressing a play day. Extracted from
 * AvailabilityCalendar so the orchestrator component stays focused on
 * composing the calendar's pieces rather than owning every field's state.
 */
export function useNoteEditorState({
  readOnly,
  availability,
  playDateNotes,
  onToggle,
  onUpdatePlayDateNote,
}: UseNoteEditorStateArgs) {
  const [commentingDate, setCommentingDate] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [availableAfterText, setAvailableAfterText] = useState("");
  const [availableUntilText, setAvailableUntilText] = useState("");
  const [gmNoteText, setGmNoteText] = useState("");

  const handleEditComment = (dateStr: string) => {
    if (readOnly) return;
    setCommentingDate(dateStr);
    setCommentText(availability[dateStr]?.comment || "");
    // Load time fields, converting HH:MM:SS to HH:MM for input
    const after = availability[dateStr]?.available_after;
    const until = availability[dateStr]?.available_until;
    setAvailableAfterText(after ? after.slice(0, 5) : "");
    setAvailableUntilText(until ? until.slice(0, 5) : "");
    setGmNoteText(playDateNotes.get(dateStr) || "");
  };

  const handleSaveComment = () => {
    if (commentingDate) {
      // Only update availability if the user has set a status (don't auto-create one)
      const currentAvail = availability[commentingDate];
      if (currentAvail) {
        onToggle(
          commentingDate,
          currentAvail.status,
          commentText.trim() || null,
          availableAfterText || null,
          availableUntilText || null
        );
      }
      // Save GM note if changed and user is GM
      const existingNote = playDateNotes.get(commentingDate) || "";
      const newNote = gmNoteText.trim();
      if (onUpdatePlayDateNote && newNote !== existingNote) {
        onUpdatePlayDateNote(commentingDate, newNote || null);
      }
      setCommentingDate(null);
      setCommentText("");
      setAvailableAfterText("");
      setAvailableUntilText("");
      setGmNoteText("");
    }
  };

  const handleCancelComment = () => {
    setCommentingDate(null);
    setCommentText("");
    setAvailableAfterText("");
    setAvailableUntilText("");
    setGmNoteText("");
  };

  return {
    commentingDate,
    commentText,
    availableAfterText,
    availableUntilText,
    gmNoteText,
    setCommentText,
    setAvailableAfterText,
    setAvailableUntilText,
    setGmNoteText,
    handleEditComment,
    handleSaveComment,
    handleCancelComment,
  };
}

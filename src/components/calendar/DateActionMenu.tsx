'use client';

import { format, parseISO } from 'date-fns';
import { Modal, Button } from '@/components/ui';

interface DateActionMenuProps {
  /** The extra play date (yyyy-MM-dd) the menu was opened for. */
  date: string;
  /** Whether the game has regular play days (changes the remove-button label). */
  hasPlayDays: boolean;
  onClose: () => void;
  onEditNote: () => void;
  onRemoveExtra: () => void;
}

// GM long-press action menu for extra play dates (edit note or remove).
export function DateActionMenu({
  date,
  hasPlayDays,
  onClose,
  onEditNote,
  onRemoveExtra,
}: DateActionMenuProps) {
  return (
    <Modal open onClose={onClose} title={format(parseISO(date), 'MMM d')}>
      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="w-full justify-start"
          onClick={onEditNote}
        >
          Add/Edit note
        </Button>
        <Button
          variant="danger"
          size="sm"
          className="w-full justify-start"
          onClick={onRemoveExtra}
        >
          {hasPlayDays ? "Remove extra date" : "Remove play date"}
        </Button>
      </div>
    </Modal>
  );
}

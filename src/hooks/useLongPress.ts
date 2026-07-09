'use client';

import { useRef } from 'react';

/**
 * Long-press touch handling for calendar day cells (500ms threshold by default).
 * Extracted verbatim from MonthCalendar so the timing/threshold behavior is
 * shared and independently reusable.
 *
 * `onLongPress` receives the same (dateStr, isRegularPlayDay, isExtraPlayDate)
 * tuple the day cell already computes, and decides what a long-press should do.
 *
 * Returns touch handlers to wire onto the cell, plus `consumeLongPress()` —
 * call it from a click handler to detect (and reset) a just-fired long-press
 * so the trailing click doesn't also run.
 */
export function useLongPress(
  onLongPress: (dateStr: string, isRegularPlayDay: boolean, isExtraPlayDate: boolean) => void,
  delay = 500
) {
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);

  const handleTouchStart = (
    dateStr: string,
    isRegularPlayDay: boolean,
    isExtraPlayDate: boolean
  ) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      onLongPress(dateStr, isRegularPlayDay, isExtraPlayDate);
    }, delay);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  /** Returns true (and resets the flag) if the preceding gesture was a long-press. */
  const consumeLongPress = () => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return true;
    }
    return false;
  };

  return { handleTouchStart, handleTouchEnd, consumeLongPress };
}

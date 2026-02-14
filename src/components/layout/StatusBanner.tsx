'use client';

import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { TIMEOUTS } from '@/lib/constants';

const warningMessage = process.env.NEXT_PUBLIC_WARNING_MESSAGE || '';

export function StatusBanner() {
  const { backendError, user, refreshProfile } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [prevBackendError, setPrevBackendError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Re-show banner when backendError transitions to true (adjust state during render)
  if (backendError !== prevBackendError) {
    setPrevBackendError(backendError);
    if (backendError) {
      setDismissed(false);
    }
  }

  const hasWarningMessage = warningMessage.length > 0;
  const shouldShow = (hasWarningMessage || backendError) && !dismissed;

  const message = hasWarningMessage
    ? warningMessage
    : "We're having trouble connecting to our servers.";

  // Auto-retry profile fetch when backend error is detected
  useEffect(() => {
    if (backendError && user) {
      intervalRef.current = setInterval(() => {
        refreshProfile();
      }, TIMEOUTS.BACKEND_HEALTH_RECHECK);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }

    // Clear interval when error resolves
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [backendError, user, refreshProfile]);

  if (!shouldShow) return null;

  return (
    <div
      role="alert"
      className="bg-[var(--warning-muted)] border-b border-[var(--warning)] px-4 py-2.5"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--warning)]" />
        <p className="flex-1 text-sm text-[var(--foreground)]">{message}</p>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded p-1 text-[var(--foreground)] opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Dismiss warning"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

'use client';

import { Link2, Copy } from 'lucide-react';
import { useToast } from '@/components/ui';

interface CalendarSubscribeButtonProps {
  /** Absolute webcal://… subscription URL. Empty string until known client-side. */
  webcalUrl: string;
  className?: string;
}

export function CalendarSubscribeButton({ webcalUrl, className = '' }: CalendarSubscribeButtonProps) {
  const toast = useToast();

  if (!webcalUrl) return null;

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(webcalUrl);
      toast.show('Calendar URL copied to clipboard.');
    } catch {
      toast.show('Could not copy. Select the URL manually.', 'danger');
    }
  };

  return (
    <span className={`inline-flex items-center gap-1 ${className}`} data-testid="calendar-subscribe">
      <a
        href={webcalUrl}
        data-testid="calendar-subscribe-link"
        title="Subscribe in your calendar app — auto-syncs confirmed sessions to Google Calendar, Apple Calendar, or Outlook"
        className="inline-flex items-center justify-center rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
      >
        <Link2 className="mr-1 size-3" />
        Subscribe
      </a>
      <button
        type="button"
        onClick={copyUrl}
        data-testid="calendar-subscribe-copy"
        aria-label="Copy calendar subscription URL"
        title="Copy the webcal:// URL to your clipboard"
        className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <Copy className="size-3.5" />
      </button>
    </span>
  );
}

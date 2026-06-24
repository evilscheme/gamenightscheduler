'use client';

import { ReactNode } from 'react';
import Image from 'next/image';

export interface OnboardingBannerProps {
  /** Leading visual; defaults to the app logo. */
  icon?: ReactNode;
  title: string;
  description: string;
  ctaLabel: string;
  onCta: () => void;
}

export function OnboardingBanner({
  icon,
  title,
  description,
  ctaLabel,
  onCta,
}: OnboardingBannerProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-xl bg-primary px-5 py-4 text-primary-foreground shadow-lg sm:flex-row sm:items-center">
      <div className="flex items-center justify-center rounded-lg bg-primary-foreground/15 p-2 shrink-0 self-start sm:self-center">
        {icon ?? (
          <Image src="/logo.png" alt="Can We Play?" width={40} height={40} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold leading-tight">{title}</p>
        <p className="text-sm opacity-90 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={onCta}
        className="shrink-0 inline-flex items-center justify-center gap-2 rounded-lg bg-primary-foreground px-4 py-2.5 text-sm font-bold text-primary transition-transform hover:scale-[1.03] w-full sm:w-auto"
      >
        {ctaLabel}
        <span aria-hidden className="motion-safe:animate-pulse">→</span>
      </button>
    </div>
  );
}

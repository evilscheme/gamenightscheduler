'use client';

import { useState } from 'react';
import { getAvatarColorClass, getInitial } from '@/lib/avatarColor';

export type AvatarRingState = 'available' | 'maybe' | 'unavailable' | 'unset' | 'none';

interface AvatarProps {
  userId: string;
  name: string | null | undefined;
  avatarUrl?: string | null;
  size?: 18 | 22 | 30;
  ring?: AvatarRingState;
  className?: string;
}

const SIZE_CLASSES: Record<18 | 22 | 30, string> = {
  18: 'h-[18px] w-[18px] text-[10px]',
  22: 'h-[22px] w-[22px] text-[11px]',
  30: 'h-[30px] w-[30px] text-[13px]',
};

const RING_CLASSES: Record<AvatarRingState, string> = {
  available: 'ring-2 ring-success',
  maybe: 'ring-2 ring-warning',
  unavailable: 'ring-2 ring-danger',
  unset: 'ring-2 ring-border',
  none: 'ring-1 ring-card',
};

export function Avatar({ userId, name, avatarUrl, size = 22, ring = 'none', className = '' }: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!avatarUrl && !imageFailed;
  const label = name ?? 'Unknown player';

  return (
    <span
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-full font-mono font-bold text-primary-foreground ${showImage ? '' : getAvatarColorClass(userId)} ${SIZE_CLASSES[size]} ${RING_CLASSES[ring]} ${className}`}
      aria-label={label}
      title={label}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl!}
          alt=""
          className="size-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        getInitial(name)
      )}
    </span>
  );
}

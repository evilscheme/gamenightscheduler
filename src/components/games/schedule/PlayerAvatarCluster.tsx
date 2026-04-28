'use client';

import { Avatar, type AvatarRingState } from '@/components/ui';
import type { User } from '@/types';

export interface PlayerAvatarItem {
  user: User;
  state: AvatarRingState;
}

interface PlayerAvatarClusterProps {
  avatars: PlayerAvatarItem[];
  size?: 18 | 22;
}

/**
 * Single source of truth for the overlapping-avatars cluster used in
 * RankedRow and ScheduledRow. Always passes avatarUrl so OAuth-supplied
 * profile photos show through; ring colour comes from the player's state.
 */
export function PlayerAvatarCluster({ avatars, size = 18 }: PlayerAvatarClusterProps) {
  if (avatars.length === 0) return null;
  return (
    <div className="flex -space-x-1">
      {avatars.map((a) => (
        <Avatar
          key={a.user.id}
          userId={a.user.id}
          name={a.user.name}
          avatarUrl={a.user.avatar_url}
          size={size}
          ring={a.state}
        />
      ))}
    </div>
  );
}

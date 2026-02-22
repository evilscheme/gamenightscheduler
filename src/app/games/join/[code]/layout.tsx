import { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { DAY_LABELS } from '@/lib/constants';
import { GameWithGMNameResult } from '@/types';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { code } = await params;

  try {
    const admin = createAdminClient();

    const { data: game, error } = await admin
      .from('games')
      .select('name, description, play_days, gm:users!games_gm_id_fkey(name)')
      .eq('invite_code', code)
      .single();

    if (error || !game) {
      return {
        title: 'Game Invite',
        description: 'Join a game night on Can We Play?',
      };
    }

    // TypeScript infers FK relations as arrays, but at runtime Supabase
    // returns single objects for one-to-one relations
    const typedGame = game as unknown as GameWithGMNameResult;
    const playDays = typedGame.play_days.map((d: number) => DAY_LABELS.short[d]).join(', ');
    const gmName = typedGame.gm?.name || 'Unknown';
    const schedule = playDays ? `Plays on: ${playDays}` : 'Ad-hoc scheduling';

    return {
      title: `${game.name} - Game Invite - Can We Play?`,
      description: game.description || `Join ${gmName}'s game — ${schedule.toLowerCase()}`,
      openGraph: {
        title: `${game.name} - Game Invite`,
        description: `Game Master: ${gmName} | ${schedule}`,
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${game.name} - Game Invite`,
        description: `Game Master: ${gmName} | ${schedule}`,
      },
    };
  } catch {
    return {
      title: 'Game Invite',
      description: 'Join a game night on Can We Play?',
    };
  }
}

export default function JoinGameLayout({ children }: LayoutProps) {
  return children;
}

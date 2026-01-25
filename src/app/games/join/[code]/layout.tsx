import { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { DAY_LABELS } from '@/lib/constants';
import { GameWithGMNameRaw, getGMName } from '@/types';

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
        title: 'Game Invite - Can We Play?',
        description: 'Join a game night on Can We Play?',
      };
    }

    // Type the result - Supabase infers FK relations as arrays
    const typedGame = game as GameWithGMNameRaw;
    const playDays = typedGame.play_days.map((d: number) => DAY_LABELS.short[d]).join(', ');
    const gmName = getGMName(typedGame);

    return {
      title: `${game.name} - Game Invite - Can We Play?`,
      description: game.description || `Join ${gmName}'s game on ${playDays}`,
      openGraph: {
        title: `${game.name} - Game Invite`,
        description: `Game Master: ${gmName} | Plays on: ${playDays}`,
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${game.name} - Game Invite`,
        description: `Game Master: ${gmName} | Plays on: ${playDays}`,
      },
    };
  } catch {
    return {
      title: 'Game Invite - Can We Play?',
      description: 'Join a game night on Can We Play?',
    };
  }
}

export default function JoinGameLayout({ children }: LayoutProps) {
  return children;
}

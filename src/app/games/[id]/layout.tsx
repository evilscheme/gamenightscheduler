import { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const admin = createAdminClient();
    const { data: game } = await admin
      .from('games')
      .select('name')
      .eq('id', id)
      .single();

    if (game) {
      return { title: game.name };
    }
  } catch {
    // Fall through to default
  }

  return { title: 'Game' };
}

export default function GameLayout({ children }: LayoutProps) {
  return children;
}

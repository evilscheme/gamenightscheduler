import { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchGameName } from '@/lib/data/games';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const admin = createAdminClient();
    const { data: game } = await fetchGameName(admin, id);

    if (game) {
      return { title: `Edit ${game.name}` };
    }
  } catch {
    // Fall through to default
  }

  return { title: 'Edit Game' };
}

export default function EditGameLayout({ children }: LayoutProps) {
  return children;
}

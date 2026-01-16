import { ImageResponse } from 'next/og';
import { DAY_LABELS } from '@/lib/constants';

export const runtime = 'edge';

export const alt = 'Game Invite - Can We Play?';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

interface GamePreview {
  name: string;
  description: string | null;
  play_days: number[];
  gm_name: string;
}

async function getGamePreview(code: string): Promise<GamePreview | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/games/preview/${code}`, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const game = await getGamePreview(code);

  if (!game) {
    // Fallback to static image style if game not found
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 64,
              fontWeight: 700,
              color: 'white',
              marginBottom: 16,
            }}
          >
            Game Not Found
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              color: '#94a3b8',
            }}
          >
            This invite link may be invalid or expired
          </div>
        </div>
      ),
      { ...size }
    );
  }

  const playDays = game.play_days.map((d) => DAY_LABELS.short[d]).join(', ');

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          fontFamily: 'system-ui, sans-serif',
          padding: 48,
        }}
      >
        {/* Invite badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'rgba(251, 191, 36, 0.15)',
            border: '2px solid #fbbf24',
            borderRadius: 9999,
            padding: '12px 28px',
            marginBottom: 40,
          }}
        >
          <div style={{ fontSize: 28, display: 'flex' }}>🎲</div>
          <div
            style={{
              display: 'flex',
              fontSize: 24,
              fontWeight: 600,
              color: '#fbbf24',
              textTransform: 'uppercase',
              letterSpacing: 2,
            }}
          >
            Game Invite
          </div>
        </div>

        {/* Game name */}
        <div
          style={{
            display: 'flex',
            fontSize: 64,
            fontWeight: 700,
            color: 'white',
            marginBottom: 24,
            textAlign: 'center',
            maxWidth: '90%',
          }}
        >
          {game.name.length > 40 ? game.name.substring(0, 40) + '...' : game.name}
        </div>

        {/* GM name */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              color: '#94a3b8',
            }}
          >
            Game Master:
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              fontWeight: 600,
              color: 'white',
            }}
          >
            {game.gm_name}
          </div>
        </div>

        {/* Play days */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 48,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              color: '#94a3b8',
            }}
          >
            Plays on:
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              fontWeight: 600,
              color: '#22c55e',
            }}
          >
            {playDays}
          </div>
        </div>

        {/* App branding */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            position: 'absolute',
            bottom: 40,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1a1a2e"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 24,
              fontWeight: 600,
              color: '#94a3b8',
            }}
          >
            Can We Play?
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}

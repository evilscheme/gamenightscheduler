import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Can We Play? - Game Night Scheduler';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
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
        {/* Calendar icon representation */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 120,
            height: 120,
            borderRadius: 24,
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            marginBottom: 32,
            boxShadow: '0 8px 32px rgba(251, 191, 36, 0.3)',
          }}
        >
          <svg
            width="64"
            height="64"
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
            <path d="M9 16l2 2 4-4" stroke="#16a34a" strokeWidth="2.5" />
          </svg>
        </div>

        {/* App name */}
        <div
          style={{
            display: 'flex',
            fontSize: 72,
            fontWeight: 700,
            color: 'white',
            marginBottom: 16,
            textShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
          }}
        >
          Can We Play?
        </div>

        {/* Tagline */}
        <div
          style={{
            display: 'flex',
            fontSize: 32,
            color: '#94a3b8',
            marginBottom: 48,
          }}
        >
          Coordinate game nights with your group
        </div>

        {/* Decorative dice icons */}
        <div
          style={{
            display: 'flex',
            gap: 24,
            opacity: 0.6,
          }}
        >
          <div style={{ fontSize: 48, display: 'flex' }}>🎲</div>
          <div style={{ fontSize: 48, display: 'flex' }}>🗓️</div>
          <div style={{ fontSize: 48, display: 'flex' }}>👥</div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

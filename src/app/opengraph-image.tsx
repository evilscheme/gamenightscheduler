import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Can We Play? - Game Night Scheduler';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const logoUrl = `${baseUrl}/logo.png`;

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
        {/* Logo */}
        <img
          src={logoUrl}
          alt="Can We Play? logo"
          width={200}
          height={200}
          style={{
            marginBottom: 32,
          }}
        />

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
          }}
        >
          Coordinate game nights with your group
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

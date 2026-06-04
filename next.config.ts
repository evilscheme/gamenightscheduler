import type { NextConfig } from "next";

// In production, Vercel Analytics & Speed Insights serve their scripts same-origin
// (/_vercel/*), so 'self' already covers them. In development the packages load a
// debug script from va.vercel-scripts.com and beacon to Vercel's collection endpoints,
// so widen the CSP for dev only — keeping the production policy as tight as possible.
const isDev = process.env.NODE_ENV !== 'production';
const vercelAnalyticsScriptSrc = isDev ? ['https://va.vercel-scripts.com'] : [];
const vercelAnalyticsConnectSrc = isDev
  ? ['https://va.vercel-scripts.com', 'https://vitals.vercel-analytics.com']
  : [];

const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  "'unsafe-eval'",
  ...vercelAnalyticsScriptSrc,
].join(' ');

// Build connect-src dynamically so the CSP allows the configured Supabase URL
// (cloud in production, localhost in local development)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const connectSrc = [
  "'self'",
  'https://*.supabase.co',
  // Include the exact Supabase URL for local development (http://localhost:54321)
  ...(supabaseUrl && !supabaseUrl.includes('.supabase.co') ? [supabaseUrl] : []),
  ...vercelAnalyticsConnectSrc,
].join(' ');

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src ${scriptSrc}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' https://lh3.googleusercontent.com https://cdn.discordapp.com https://avatars.githubusercontent.com data:",
              "font-src 'self'",
              `connect-src ${connectSrc}`,
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

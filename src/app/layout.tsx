import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Providers, Navbar, StatusBanner } from '@/components/layout';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const viewport: Viewport = {
  themeColor: '#0ea5e9',
};

export const metadata: Metadata = {
  title: 'Can We Play? - Game Night Scheduler',
  description: 'Coordinate game nights with your group',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Can We Play?',
  },
  openGraph: {
    title: 'Can We Play?',
    description: 'Coordinate game nights with your group',
    siteName: 'Can We Play?',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Can We Play?',
    description: 'Coordinate game nights with your group',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <Navbar />
          <StatusBanner />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}

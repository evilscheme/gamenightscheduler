import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help & Guide',
  description:
    'Learn how to create games, mark availability, schedule sessions, and get the most out of Can We Play?',
  alternates: { canonical: '/help' },
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'New Game',
};

export default function NewGameLayout({ children }: { children: React.ReactNode }) {
  return children;
}

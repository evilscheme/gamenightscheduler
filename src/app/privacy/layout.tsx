import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Can We Play? handles your data — what we collect, how we use it, and your rights.',
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}

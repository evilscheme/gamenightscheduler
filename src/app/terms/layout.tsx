import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms and conditions for using Can We Play?, the free tabletop game night scheduler.',
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

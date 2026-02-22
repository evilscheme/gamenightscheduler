import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
  description:
    'Sign in with Google or Discord to start scheduling your tabletop game nights.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}

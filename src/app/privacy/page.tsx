'use client';

import { Card, CardContent, CardHeader } from '@/components/ui';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-card-foreground">{title}</h2>
      </CardHeader>
      <CardContent className="space-y-3 text-sm/relaxed text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  );
}

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Privacy Policy</h1>
        <p className="mt-2 text-muted-foreground">
          Effective February 2026
        </p>
      </div>

      <div className="space-y-6">
        <Section title="What We Collect">
          <p>
            When you sign in with Google or Discord, we receive your <strong className="text-foreground">name</strong>,{' '}
            <strong className="text-foreground">email address</strong>, and{' '}
            <strong className="text-foreground">profile picture</strong> from your account. We use this to
            create your profile on Can We Play?.
          </p>
          <p>
            As you use the app, we store the <strong className="text-foreground">availability and scheduling
            data</strong> you provide &mdash; which dates you can play, any time constraints, and comments
            you leave on specific dates.
          </p>
        </Section>

        <Section title="How We Use Your Data">
          <p>
            Your data is used solely to provide the scheduling service. Specifically:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Your name and avatar are shown to other players in your games</li>
            <li>Your email is used for account identification and is not shared with other users</li>
            <li>Your availability data is visible to other members of the games you join</li>
          </ul>
          <p>
            We do not sell, rent, or share your personal information with third parties for marketing
            purposes. We do not serve ads. We do not use your data for any purpose other than
            running Can We Play?.
          </p>
        </Section>

        <Section title="Third-Party Services">
          <p>
            Can We Play? relies on the following third-party services:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>
              <strong className="text-foreground">Supabase</strong> &mdash; hosts our database and
              handles authentication. Your data is stored on Supabase&apos;s infrastructure.
              See{' '}
              <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Supabase&apos;s Privacy Policy
              </a>.
            </li>
            <li>
              <strong className="text-foreground">Google</strong> &mdash; provides sign-in via OAuth.
              See{' '}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Google&apos;s Privacy Policy
              </a>.
            </li>
            <li>
              <strong className="text-foreground">Discord</strong> &mdash; provides sign-in via OAuth.
              See{' '}
              <a href="https://discord.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Discord&apos;s Privacy Policy
              </a>.
            </li>
            <li>
              <strong className="text-foreground">Vercel</strong> &mdash; hosts the application.
              See{' '}
              <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Vercel&apos;s Privacy Policy
              </a>.
            </li>
          </ul>
        </Section>

        <Section title="Cookies & Local Storage">
          <p>
            We use a session cookie provided by Supabase to keep you signed in. We do not use
            tracking cookies, analytics cookies, or any third-party cookies. Your theme preference
            is stored in your browser&apos;s local storage.
          </p>
        </Section>

        <Section title="Data Retention & Deletion">
          <p>
            Your data is retained as long as you have an account. You can delete your account
            at any time from{' '}
            <a href="/settings" className="text-primary hover:underline">Settings</a>{' '}
            &gt; Danger Zone &gt; Delete Account. This permanently removes your profile,
            availability data, and game memberships.
          </p>
          <p>
            For games you own, you will be asked to either delete the game or transfer ownership
            to another player before your account is removed.
          </p>
        </Section>

        <Section title="Changes to This Policy">
          <p>
            We may update this privacy policy from time to time. Changes will be posted on this
            page with an updated effective date. Continued use of the app after changes constitutes
            acceptance of the updated policy.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            If you have questions about this privacy policy, you can reach us via the feedback
            link in the app.
          </p>
        </Section>
      </div>
    </div>
  );
}

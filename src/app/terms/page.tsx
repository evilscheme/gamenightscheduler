'use client';

import { Card, CardContent, CardHeader } from '@/components/ui';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-card-foreground">{title}</h2>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        {children}
      </CardContent>
    </Card>
  );
}

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Terms of Service</h1>
        <p className="mt-2 text-muted-foreground">
          Effective February 2026
        </p>
      </div>

      <div className="space-y-6">
        <Section title="Description of Service">
          <p>
            Can We Play? is a free scheduling tool that helps tabletop gaming groups coordinate
            game nights. Players mark their availability on a shared calendar, and the app
            suggests optimal dates based on everyone&apos;s schedules.
          </p>
        </Section>

        <Section title="User Accounts">
          <p>
            You sign in using your Google or Discord account. You are responsible for maintaining
            the security of your account credentials with those providers. You are responsible
            for all activity that occurs under your account on Can We Play?.
          </p>
        </Section>

        <Section title="Acceptable Use">
          <p>
            You agree to use Can We Play? for its intended purpose of scheduling game nights.
            You agree not to:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Use the service for any unlawful purpose</li>
            <li>Attempt to gain unauthorized access to the service or its systems</li>
            <li>Interfere with or disrupt the service for other users</li>
            <li>Use automated tools to scrape or abuse the service</li>
          </ul>
        </Section>

        <Section title="User Content">
          <p>
            You retain ownership of any content you submit (game names, comments, etc.).
            By submitting content, you grant us a license to store and display it as
            necessary to operate the service. Content you share within a game is visible to
            other members of that game.
          </p>
        </Section>

        <Section title="Service Availability">
          <p>
            Can We Play? is provided as a free community tool. We make no guarantees about
            uptime, availability, or continued operation of the service. We may modify,
            suspend, or discontinue the service at any time without notice.
          </p>
        </Section>

        <Section title="Limitation of Liability">
          <p>
            Can We Play? is provided &ldquo;as is&rdquo; without warranties of any kind,
            either express or implied. We are not liable for any damages arising from
            your use of the service, including but not limited to loss of data, missed
            game nights, or scheduling conflicts.
          </p>
        </Section>

        <Section title="Account Termination">
          <p>
            We reserve the right to suspend or terminate accounts that violate these terms.
            If you want to delete your account, contact us using the feedback link in the app
            and we will remove your account and all associated data.
          </p>
        </Section>

        <Section title="Changes to These Terms">
          <p>
            We may update these terms from time to time. Changes will be posted on this
            page with an updated effective date. Continued use of the app after changes
            constitutes acceptance of the updated terms.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            If you have questions about these terms, you can reach us via the feedback link
            in the app.
          </p>
        </Section>
      </div>
    </div>
  );
}

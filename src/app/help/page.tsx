'use client';

import Link from 'next/link';
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

export default function HelpPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">How to Use Can We Play?</h1>
        <p className="mt-2 text-muted-foreground">
          A guide for GMs and players to get the most out of scheduling game nights.
        </p>
      </div>

      <div className="space-y-6">
        {/* Getting Started */}
        <Section title="Getting Started">
          <p>
            <strong className="text-foreground">Can We Play?</strong> helps tabletop gaming groups find the best dates
            to play. GMs create games and share invite links, players mark their availability on a calendar,
            and the app suggests optimal dates based on everyone&apos;s schedules.
          </p>
          <p>
            Sign in with your Google or Discord account to get started. Once signed in, you can
            create games as a GM or join existing games using an invite link.
          </p>
        </Section>

        {/* For GMs */}
        <div>
          <h2 className="text-xl font-bold text-foreground mb-4">For GMs</h2>
          <div className="space-y-6">
            <Section title="Creating a Game">
              <p>
                Click <strong className="text-foreground">New Game</strong> in the navigation bar to create a game.
                You&apos;ll set:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li><strong className="text-foreground">Game name</strong> &mdash; the title your players will see</li>
                <li><strong className="text-foreground">Play days</strong> &mdash; which days of the week you typically play (e.g., Saturdays)</li>
                <li><strong className="text-foreground">Scheduling window</strong> &mdash; how many weeks ahead players should mark availability</li>
                <li><strong className="text-foreground">Default session times</strong> &mdash; the usual start and end times for your sessions</li>
                <li><strong className="text-foreground">Minimum players</strong> &mdash; the fewest players needed to run a session</li>
              </ul>
            </Section>

            <Section title="Inviting Players">
              <p>
                Every game has a unique invite link. Share it with your players and they can join
                with one click. You&apos;ll find the invite link on your game&apos;s detail page.
              </p>
            </Section>

            <Section title="Managing Players & Co-GMs">
              <p>
                On the game detail page you can see all players and their availability completion.
                You can promote any player to <strong className="text-foreground">co-GM</strong>, which gives
                them the ability to edit game settings and confirm sessions.
                You can also remove players from the game if needed.
              </p>
            </Section>

            <Section title="Scheduling Sessions">
              <p>
                The <strong className="text-foreground">scheduling suggestions</strong> section ranks upcoming dates
                by how many players are available. Each date shows a breakdown of who is available,
                who said maybe, and who can&apos;t make it.
              </p>
              <p>
                When you&apos;re ready, click a date to confirm it as a session. The confirmation dialog
                pre-fills times based on player constraints and your default session times.
                Dates that don&apos;t meet the minimum player threshold are flagged so you can
                make informed decisions.
              </p>
            </Section>

            <Section title="Special Play Dates">
              <p>
                Need to schedule a one-off session on a day you don&apos;t normally play?
                GMs and co-GMs can add <strong className="text-foreground">special play dates</strong> directly
                on the calendar by clicking any non-play day. These appear alongside regular play
                days so players can mark availability for them.
              </p>
            </Section>

            <Section title="Calendar Export">
              <p>
                Confirmed sessions can be exported to your calendar app. You can download
                an <strong className="text-foreground">.ics file</strong> for individual sessions or subscribe to
                a <strong className="text-foreground">webcal:// feed</strong> that automatically stays up to date
                as new sessions are confirmed.
              </p>
            </Section>
          </div>
        </div>

        {/* For Players */}
        <div>
          <h2 className="text-xl font-bold text-foreground mb-4">For Players</h2>
          <div className="space-y-6">
            <Section title="Joining a Game">
              <p>
                Your GM will share an invite link with you. Click it, sign in if you haven&apos;t
                already, and you&apos;ll be added to the game. You can also paste the invite code
                directly if needed.
              </p>
            </Section>

            <Section title="Marking Availability">
              <p>
                On the game page, you&apos;ll see a calendar showing upcoming play days. Click any
                date to cycle through three states:
              </p>
              <ul className="space-y-2 ml-1">
                <li className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-sm bg-green-500 shrink-0" />
                  <span><strong className="text-foreground">Available</strong> &mdash; you can play this date</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-sm bg-red-500 shrink-0" />
                  <span><strong className="text-foreground">Unavailable</strong> &mdash; you can&apos;t make it</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-sm bg-yellow-500 shrink-0" />
                  <span><strong className="text-foreground">Maybe</strong> &mdash; you might be able to play</span>
                </li>
              </ul>
              <p>
                Dates you haven&apos;t responded to yet show as <strong className="text-foreground">pending</strong>.
                Try to fill in all dates so your GM can make the best scheduling decisions.
              </p>
            </Section>

            <Section title="Adding Notes & Time Constraints">
              <p>
                Long-press or hover over any date to add details. You can leave
                a <strong className="text-foreground">comment</strong> (e.g., &ldquo;leaving at 9 PM&rdquo;) and
                set <strong className="text-foreground">time constraints</strong> if you&apos;re only available
                during part of the session window (e.g., available after 7 PM or until 10 PM).
              </p>
            </Section>

            <Section title="Bulk Actions">
              <p>
                Don&apos;t want to click every date individually? Use the <strong className="text-foreground">bulk
                actions</strong> to mark all remaining dates or all dates on a specific day of the week
                as available, unavailable, or maybe in one go.
              </p>
            </Section>

            <Section title="Viewing Confirmed Sessions">
              <p>
                Once your GM confirms a session, it appears on the calendar with the confirmed
                time. You can export confirmed sessions to your personal calendar
                via <strong className="text-foreground">.ics download</strong> or
                a <strong className="text-foreground">webcal:// subscription</strong> that updates automatically.
              </p>
            </Section>
          </div>
        </div>

        {/* General */}
        <Section title="Customization">
          <p>
            Visit <Link href="/settings" className="text-primary hover:underline">Settings</Link> to
            update your display name and choose a color theme. Your theme preference applies
            across all your games.
          </p>
        </Section>
      </div>
    </div>
  );
}

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
          Everything you need to know about scheduling game nights.
        </p>
      </div>

      <div className="space-y-6">
        {/* Getting Started */}
        <Section title="Getting Started">
          <p>
            <strong className="text-foreground">Can We Play?</strong> is a scheduling tool for tabletop gaming groups.
            GMs create games and share invite links, players mark when they&apos;re free on a calendar,
            and the app figures out which dates work for the most people.
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
                <li><strong className="text-foreground">Scheduling window</strong> &mdash; how many months ahead players should mark availability</li>
                <li><strong className="text-foreground">Default session times</strong> &mdash; the default start and end times for your sessions</li>
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
                You can promote any player to <strong className="text-foreground">co-GM</strong> so they
                can edit game settings and confirm sessions too.
                You can also remove players from the game.
              </p>
            </Section>

            <Section title="Scheduling Sessions">
              <p>
                The <strong className="text-foreground">scheduling suggestions</strong> section shows upcoming dates
                ranked by how many players can make it. Each date breaks down who&apos;s available,
                who said maybe, and who can&apos;t come.
              </p>
              <p>
                You can switch between <strong className="text-foreground">Best Match</strong> (ranked by
                availability) and <strong className="text-foreground">By Date</strong> (chronological) sorting
                using the toggle at the top of the suggestions list.
              </p>
              <p>
                When you&apos;re ready, click a date to confirm it as a session. The confirmation dialog
                pre-fills times based on player constraints and your default session times.
                Dates that don&apos;t meet the minimum player count are flagged so you know
                before committing.
              </p>
            </Section>

            <Section title="Ad-Hoc Scheduling">
              <p>
                Not every game has a regular weekly schedule. When creating or editing a game, toggle
                on <strong className="text-foreground">ad-hoc scheduling</strong> to skip selecting play days entirely.
                Instead, you add specific dates on the calendar using
                the <strong className="text-foreground">+</strong> button. Works well for one-shots,
                irregular schedules, or groups that play on different days each time.
              </p>
            </Section>

            <Section title="Extra Play Dates">
              <p>
                Want to schedule a one-off session on a day you don&apos;t normally play?
                GMs and co-GMs can add <strong className="text-foreground">extra dates</strong> by clicking
                any non-play day on the calendar. They show up alongside regular play
                days so players can mark availability for them.
              </p>
            </Section>

            <Section title="Play Date Notes">
              <p>
                GMs can add <strong className="text-foreground">notes</strong> to any play date. Click on a date to open the detail popover and add a note (e.g.,
                &ldquo;Session zero&rdquo; or &ldquo;Character creation&rdquo;). Notes are visible to all
                players on the calendar and in scheduling suggestions.
              </p>
            </Section>

            <Section title="Calendar Export">
              <p>
                You can add confirmed sessions to your calendar app. Download
                an <strong className="text-foreground">.ics file</strong> for a single session, or subscribe to
                a <strong className="text-foreground">webcal:// feed</strong> that stays in sync as you confirm
                new sessions.
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
                Fill in all your dates if you can &mdash; it makes scheduling a lot easier for your GM.
              </p>
            </Section>

            <Section title="Adding Notes & Time Constraints">
              <p>
                Long-press or hover on any date to add details. You can leave
                a <strong className="text-foreground">comment</strong> (e.g., &ldquo;leaving at 9 PM&rdquo;) or
                set <strong className="text-foreground">time constraints</strong> if you can only make part of
                the session (e.g., available after 7 PM or until 10 PM).
              </p>
            </Section>

            <Section title="Bulk Actions">
              <p>
                Don&apos;t want to click every date one by one? Use <strong className="text-foreground">bulk
                actions</strong> to mark all remaining dates, or all dates on a specific day of the week,
                as available, unavailable, or maybe at once.
              </p>
            </Section>

            <Section title="Copy Availability">
              <p>
                Playing in multiple games with overlapping dates? Use <strong className="text-foreground">Copy
                from</strong> in the bulk actions bar to pull your availability over from another game.
                It only fills in dates you haven&apos;t responded to yet &mdash; it won&apos;t touch
                anything you&apos;ve already set.
              </p>
            </Section>

            <Section title="Viewing Confirmed Sessions">
              <p>
                Once your GM confirms a session, it shows up on the calendar with the confirmed
                time. You can add it to your personal calendar
                with an <strong className="text-foreground">.ics download</strong> or
                a <strong className="text-foreground">webcal:// subscription</strong> that stays in sync automatically.
              </p>
            </Section>
          </div>
        </div>

        {/* General */}
        <Section title="Customization">
          <p>
            Head to <Link href="/settings" className="text-primary hover:underline">Settings</Link> to
            change your display name, pick a color theme, and set your preferences:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li><strong className="text-foreground">Timezone</strong> &mdash; so session times show up correctly for you</li>
            <li><strong className="text-foreground">Week start</strong> &mdash; Sunday or Monday, your call</li>
            <li><strong className="text-foreground">Time format</strong> &mdash; 12-hour or 24-hour</li>
            <li><strong className="text-foreground">Color theme</strong> &mdash; applies across all your games</li>
          </ul>
        </Section>

        <Section title="Install on Your Device">
          <p>
            You can install <strong className="text-foreground">Can We Play?</strong> as an app on your
            phone or tablet. On iOS, tap the share button in Safari and choose <strong className="text-foreground">Add
            to Home Screen</strong>. On Android, tap the browser menu and
            choose <strong className="text-foreground">Install app</strong>. It runs fullscreen without
            the browser toolbar.
          </p>
        </Section>
      </div>
    </div>
  );
}

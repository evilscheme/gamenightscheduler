'use client';

import Link from 'next/link';
import { EyebrowLabel } from '@/components/ui';

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <EyebrowLabel className="mb-4 block">{title}</EyebrowLabel>
      <div className="space-y-3 text-sm/relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold text-foreground mb-3 mt-2">{children}</h2>
  );
}

export default function HelpPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">How to Use Can We Play?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything you need to know about scheduling game nights.
        </p>
      </div>

      <div className="space-y-5">
        {/* ── Getting Started ──────────────────────────────────────────── */}
        <Panel title="Getting Started">
          <p>
            <strong className="text-foreground">Can We Play?</strong> is a scheduling tool for tabletop gaming groups.
            GMs create games and share invite links, players mark when they&apos;re free on a calendar,
            and the app figures out which dates work for the most people.
          </p>
          <p>
            Sign in with your Google or Discord account to get started. Once signed in, you can
            create games as a GM or join existing games using an invite link.
          </p>
        </Panel>

        {/* ── For GMs ──────────────────────────────────────────────────── */}
        <div>
          <GroupHeading>For GMs</GroupHeading>
          <div className="space-y-5">
            <Panel title="Creating a Game">
              <p>
                Click <strong className="text-foreground">New Game</strong> in the navigation bar to create a game.
                You&apos;ll set:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li><strong className="text-foreground">Game name</strong>: the title your players will see</li>
                <li><strong className="text-foreground">Play days</strong>: which days of the week you typically play (e.g., Saturdays)</li>
                <li><strong className="text-foreground">Scheduling window</strong>: how many months ahead players should mark availability</li>
                <li><strong className="text-foreground">Default session times</strong>: the default start and end times for your sessions</li>
                <li><strong className="text-foreground">Campaign dates</strong> (optional): a custom start and/or end date that limits the calendar window for this game</li>
              </ul>
              <p>
                Other settings, including minimum players, can be adjusted later from
                the game&apos;s <strong className="text-foreground">Edit</strong> page.
              </p>
            </Panel>

            <Panel title="Campaign Dates">
              <p>
                By default, the calendar shows dates from today through the scheduling window.
                If your campaign has a known start or end, set campaign dates on the
                create or edit page to clamp the calendar to that range.
              </p>
              <p>
                Dates outside the campaign window are shown as out-of-range and can&apos;t be marked
                or confirmed as sessions, so players only see dates that actually matter.
              </p>
            </Panel>

            <Panel title="Inviting Players">
              <p>
                Every game has a unique invite link. Share it with your players and they can join
                with one click. You&apos;ll find the invite link on your game&apos;s detail page.
              </p>
            </Panel>

            <Panel title="Managing Players & Co-GMs">
              <p>
                On the game detail page you can see all players and their availability completion.
                You can promote any player to co-GM so they can edit game settings
                and confirm sessions too.
                You can also remove players from the game.
              </p>
            </Panel>

            <Panel title="Scheduling Sessions">
              <p>
                The <strong className="text-foreground">Schedule</strong> tab lists already-confirmed
                sessions at the top, then ranks upcoming dates by how many players can make it.
                Each date breaks down who&apos;s available, who said maybe, and who can&apos;t come.
              </p>
              <p>
                If you&apos;ve set a minimum players threshold on the Edit page, dates
                that don&apos;t meet it are split into a separate section and flagged so
                you know before committing.
              </p>
              <p>
                When you&apos;re ready, expand a date and click <strong className="text-foreground">Schedule game</strong>.
                The confirmation dialog pre-fills times based on player constraints and your
                default session times.
              </p>
            </Panel>

            <Panel title="Ad-Hoc Scheduling">
              <p>
                Not every game has a regular weekly schedule. When creating or editing a game, toggle
                on <strong className="text-foreground">ad-hoc scheduling</strong> to skip selecting play days entirely.
                Instead, you add specific dates on the calendar using
                the <strong className="text-foreground">+</strong> button. Works well for one-shots,
                irregular schedules, or groups that play on different days each time.
              </p>
            </Panel>

            <Panel title="Extra Play Dates">
              <p>
                For one-off sessions on a day you don&apos;t normally play, GMs and co-GMs
                can add extra dates by clicking the <strong className="text-foreground">+</strong> button
                on any non-play day on the calendar. They show up alongside regular
                play days so players can mark availability for them.
              </p>
            </Panel>

            <Panel title="Play Date Notes">
              <p>
                GMs can add notes to any play date. Click the pencil icon (or long-press
                on mobile) on a date to open the detail popover and add a note (e.g.,
                &ldquo;Session zero&rdquo; or &ldquo;Character creation&rdquo;). Notes are visible to all
                players on the calendar and in scheduling suggestions.
              </p>
            </Panel>

            <Panel title="Calendar Export">
              <p>
                You can add confirmed sessions to your calendar app. Download an .ics
                file for a single session, or subscribe to a webcal:// feed that stays
                in sync as you confirm new sessions.
              </p>
            </Panel>
          </div>
        </div>

        {/* ── For Players ──────────────────────────────────────────────── */}
        <div>
          <GroupHeading>For Players</GroupHeading>
          <div className="space-y-5">
            <Panel title="Joining a Game">
              <p>
                Your GM will share an invite link with you. Click it, sign in if you haven&apos;t
                already, and you&apos;ll be added to the game.
              </p>
            </Panel>

            <Panel title="Marking Availability">
              <p>
                On the game page, you&apos;ll see a calendar showing upcoming play days. Click any
                date to cycle through three states:
              </p>
              <ul className="space-y-2 ml-1">
                <li className="flex items-center gap-2">
                  <span className="inline-block size-3 rounded-sm bg-green-500 shrink-0" />
                  <span><strong className="text-foreground">Available</strong>: you can play this date</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block size-3 rounded-sm bg-red-500 shrink-0" />
                  <span><strong className="text-foreground">Unavailable</strong>: you can&apos;t make it</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block size-3 rounded-sm bg-yellow-500 shrink-0" />
                  <span><strong className="text-foreground">Maybe</strong>: you might be able to play</span>
                </li>
              </ul>
              <p>
                Dates you haven&apos;t responded to yet show as <strong className="text-foreground">pending</strong>.
              </p>
            </Panel>

            <Panel title="Adding Notes & Time Constraints">
              <p>
                Once you&apos;ve set availability for a date, you can add details to it:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li>
                  On desktop: hover the date and click
                  the pencil icon in the corner to open the editor.
                </li>
                <li>
                  On mobile: long-press the date to open
                  the editor.
                </li>
              </ul>
              <p>
                In the editor you can leave a comment (e.g.,
                &ldquo;leaving at 9 PM&rdquo;) or set time constraints if you can only make part of the session (e.g., available after 7 PM or until 10 PM).
                The pencil and editor only show after you&apos;ve marked the date as available, unavailable,
                or maybe.
              </p>
            </Panel>

            <Panel title="Bulk Actions">
              <p>
                Bulk actions let you mark all remaining dates, or all dates on a specific
                day of the week, as available, unavailable, or maybe at once.
              </p>
            </Panel>

            <Panel title="Copy Availability">
              <p>
                If you&apos;re in multiple games with overlapping dates, use <strong className="text-foreground">Copy
                from</strong> in the bulk actions bar to pull your availability over from another game.
                It only fills in dates you haven&apos;t responded to yet, so anything
                you&apos;ve already set stays untouched.
              </p>
            </Panel>

            <Panel title="Viewing Confirmed Sessions">
              <p>
                Once your GM confirms a session, it shows up on the calendar with the
                confirmed time. You can add it to your personal calendar with an .ics
                download, or with a webcal:// subscription that stays in sync automatically.
              </p>
            </Panel>
          </div>
        </div>

        {/* ── General ──────────────────────────────────────────────────── */}
        <Panel title="Customization">
          <p>
            Head to <Link href="/settings" className="text-primary hover:underline">Settings</Link> to
            change your display name, pick a color theme, and set your preferences:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li><strong className="text-foreground">Timezone</strong>: so session times show up correctly for you</li>
            <li><strong className="text-foreground">Week start</strong>: Sunday or Monday, your call</li>
            <li><strong className="text-foreground">Time format</strong>: 12-hour or 24-hour</li>
            <li><strong className="text-foreground">Color theme</strong>: applies across all your games</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

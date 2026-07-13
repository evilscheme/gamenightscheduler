'use client';

import Link from 'next/link';
import { EyebrowLabel, Panel } from '@/components/ui';

function HelpSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel as="section" padded="md">
      <EyebrowLabel className="mb-4 block">{title}</EyebrowLabel>
      <div className="space-y-3 text-sm/relaxed text-muted-foreground">
        {children}
      </div>
    </Panel>
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
        <HelpSection title="Getting Started">
          <p>
            <strong className="text-foreground">Can We Play?</strong> is a scheduling tool for tabletop gaming groups.
            GMs create games and share invite links, players mark when they&apos;re free on a calendar,
            and the app figures out which dates work for the most people.
          </p>
          <p>
            Sign in with your Google or Discord account to get started. Once signed in, you can
            create games as a GM or join existing games using an invite link.
          </p>
        </HelpSection>

        {/* ── For GMs ──────────────────────────────────────────────────── */}
        <div>
          <GroupHeading>For GMs</GroupHeading>
          <div className="space-y-5">
            <HelpSection title="Creating a Game">
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
            </HelpSection>

            <HelpSection title="Campaign Dates">
              <p>
                By default, the calendar shows dates from today through the scheduling window.
                If your campaign has a known start or end, set campaign dates on the
                create or edit page to clamp the calendar to that range.
              </p>
              <p>
                Dates outside the campaign window are shown as out-of-range and can&apos;t be marked
                or confirmed as sessions, so players only see dates that actually matter.
              </p>
            </HelpSection>

            <HelpSection title="Inviting Players">
              <p>
                Every game has a unique invite link. Share it with your players &mdash; they sign
                in with Google or Discord and join from the link. You&apos;ll find the invite link
                on your game&apos;s detail page.
              </p>
            </HelpSection>

            <HelpSection title="Managing Players & Co-GMs">
              <p>
                On the game detail page you can see all players and their availability completion.
                You can promote any player to co-GM so they can edit game settings
                and confirm sessions too.
                You can also remove players from the game.
              </p>
            </HelpSection>

            <HelpSection title="Scheduling Sessions">
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
            </HelpSection>

            <HelpSection title="Ad-Hoc Scheduling">
              <p>
                Not every game has a regular weekly schedule. When creating or editing a game, toggle
                on <strong className="text-foreground">ad-hoc scheduling</strong> to skip selecting play days entirely.
                Instead, you add specific dates on the calendar using
                the <strong className="text-foreground">+</strong> button. Works well for one-shots,
                irregular schedules, or groups that play on different days each time.
              </p>
            </HelpSection>

            <HelpSection title="Extra Play Dates">
              <p>
                For one-off sessions on a day you don&apos;t normally play, GMs and co-GMs
                can add extra dates by clicking the <strong className="text-foreground">+</strong> button
                on any non-play day on the calendar. They show up alongside regular
                play days so players can mark availability for them.
              </p>
            </HelpSection>

            <HelpSection title="Play Date Notes">
              <p>
                GMs can add notes to any play date. Click the pencil icon (or long-press
                on mobile) on a date to open the detail popover and add a note (e.g.,
                &ldquo;Session zero&rdquo; or &ldquo;Character creation&rdquo;). Notes are visible to all
                players on the calendar and in scheduling suggestions.
              </p>
            </HelpSection>

            <HelpSection title="Calendar Export">
              <p>
                You can add confirmed sessions to your calendar app. Download an .ics
                file for a single session, or subscribe to a webcal:// feed that stays
                in sync as you confirm new sessions.
              </p>
            </HelpSection>
          </div>
        </div>

        {/* ── For Players ──────────────────────────────────────────────── */}
        <div>
          <GroupHeading>For Players</GroupHeading>
          <div className="space-y-5">
            <HelpSection title="Joining a Game">
              <p>
                Your GM will share an invite link with you. Click it, sign in if you haven&apos;t
                already, and you&apos;ll be added to the game.
              </p>
            </HelpSection>

            <HelpSection title="Marking Availability">
              <p>
                On the game page, you&apos;ll see a calendar showing upcoming play days. Click any
                date to cycle through three states:
              </p>
              <ul className="space-y-2 ml-1">
                <li className="flex items-center gap-2">
                  <span className="inline-block size-3 rounded-sm bg-cal-available-bg shrink-0" />
                  <span><strong className="text-foreground">Available</strong>: you can play this date</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block size-3 rounded-sm bg-cal-unavailable-bg shrink-0" />
                  <span><strong className="text-foreground">Unavailable</strong>: you can&apos;t make it</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block size-3 rounded-sm bg-cal-maybe-bg shrink-0" />
                  <span><strong className="text-foreground">Maybe</strong>: you might be able to play</span>
                </li>
              </ul>
              <p>
                Dates you haven&apos;t responded to yet show as <strong className="text-foreground">pending</strong>.
              </p>
              <p>
                If you&apos;re in more than one game, a badge marks any night where you already
                have a confirmed session in another game. To see which game, hover the date on
                desktop or long-press it on mobile; the game and time appear under <strong className="text-foreground">Scheduled
                elsewhere</strong>.
              </p>
            </HelpSection>

            <HelpSection title="Adding Notes & Time Constraints">
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
            </HelpSection>

            <HelpSection title="Bulk Actions">
              <p>
                Bulk actions let you mark all remaining dates, or all dates on a specific
                day of the week, as available, unavailable, or maybe at once.
              </p>
            </HelpSection>

            <HelpSection title="Default Availability">
              <p>
                Set your usual weekly pattern once instead of filling in every game by hand. In <Link href="/settings/default-availability" className="text-primary hover:underline">Settings &rarr; Default
                availability</Link>, pick a status for each day of the week &mdash; available,
                unavailable, maybe, or No default.
                Available and maybe days can carry the same time constraints and notes as any
                other date.
              </p>
              <p>
                On any game&apos;s Availability tab, click <strong className="text-foreground">Apply my
                default availability</strong> to fill that game&apos;s calendar from your pattern.
                It fills only the dates you haven&apos;t answered yet, leaving anything you&apos;ve
                already marked untouched, and you can apply it again later (for example, after your
                GM adds play dates). Use <strong className="text-foreground">Edit defaults</strong> beside
                the button to change your pattern.
              </p>
            </HelpSection>

            <HelpSection title="Copy Availability">
              <p>
                If you&apos;re in multiple games with overlapping dates, use <strong className="text-foreground">Copy
                from</strong> in the bulk actions bar to pull your availability over from another game.
                It only fills in dates you haven&apos;t responded to yet, so anything
                you&apos;ve already set stays untouched.
              </p>
              <p>
                If the game you&apos;re copying from has confirmed sessions on nights you
                haven&apos;t answered here, you&apos;ll first be asked how to mark those nights
                &mdash; unavailable, maybe, or available &mdash; so a booked night isn&apos;t copied
                in as available.
              </p>
            </HelpSection>

            <HelpSection title="Viewing Confirmed Sessions">
              <p>
                Once your GM confirms a session, it shows up on the calendar with the
                confirmed time. You can add it to your personal calendar with an .ics
                download, or with a webcal:// subscription that stays in sync automatically.
              </p>
            </HelpSection>
          </div>
        </div>

        {/* ── General ──────────────────────────────────────────────────── */}
        <HelpSection title="Customization">
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
          <p>
            Settings is also where you set your <strong className="text-foreground">default
            availability</strong> &mdash; the reusable weekly pattern covered under Default
            Availability above.
          </p>
        </HelpSection>
      </div>
    </div>
  );
}

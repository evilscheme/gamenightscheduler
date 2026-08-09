import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MiniCalendar } from './MiniCalendar';

// A 12-month game setting spans 13 calendar months (the window ends on the last
// day of the month 12 months out), which is the longest window the app allows.
const LONG_START = new Date(2026, 0, 15); // 15 Jan 2026
const LONG_END = new Date(2027, 0, 31); // 31 Jan 2027 -> Jan 2026 .. Jan 2027
const SHORT_START = new Date(2026, 0, 1);
const SHORT_END = new Date(2026, 2, 31); // exactly 3 months

const renderCalendar = (windowStart: Date, windowEnd: Date) =>
  render(
    <MiniCalendar
      windowStart={windowStart}
      windowEnd={windowEnd}
      suggestions={[]}
      sessions={[]}
      playDayWeekdays={new Set([5, 6])}
      specialPlayDates={new Set()}
      weekStartDay={0}
      onCellActivate={() => {}}
    />
  );

const visibleMonths = () =>
  screen.getAllByTestId('calendar-month').map((el) => el.getAttribute('data-month'));

const laterButton = () => screen.getByRole('button', { name: 'Show later months' });
const earlierButton = () => screen.getByRole('button', { name: 'Show earlier months' });

describe('MiniCalendar month paging', () => {
  it('shows only the first three months of a long window', () => {
    renderCalendar(LONG_START, LONG_END);
    expect(visibleMonths()).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('hides the pager when the whole window fits on one page', () => {
    renderCalendar(SHORT_START, SHORT_END);
    expect(visibleMonths()).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(
      screen.queryByRole('button', { name: 'Show earlier months' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Show later months' })
    ).not.toBeInTheDocument();
  });

  it('advances a full page of three months at a time', async () => {
    const user = userEvent.setup();
    renderCalendar(LONG_START, LONG_END);

    await user.click(laterButton());
    expect(visibleMonths()).toEqual(['2026-04', '2026-05', '2026-06']);

    await user.click(laterButton());
    expect(visibleMonths()).toEqual(['2026-07', '2026-08', '2026-09']);
  });

  it('steps back a full page of three months', async () => {
    const user = userEvent.setup();
    renderCalendar(LONG_START, LONG_END);

    await user.click(laterButton());
    await user.click(laterButton());
    expect(visibleMonths()).toEqual(['2026-07', '2026-08', '2026-09']);

    await user.click(earlierButton());
    expect(visibleMonths()).toEqual(['2026-04', '2026-05', '2026-06']);
  });

  it('clamps the final page to the window end rather than showing a short page', async () => {
    const user = userEvent.setup();
    renderCalendar(LONG_START, LONG_END);

    await user.click(laterButton()); // Apr-Jun
    await user.click(laterButton()); // Jul-Sep
    await user.click(laterButton()); // Oct-Dec
    expect(visibleMonths()).toEqual(['2026-10', '2026-11', '2026-12']);

    // The 13th month would otherwise sit alone on a page of its own; instead the
    // cursor stops at the last full page, so this step advances by one month.
    await user.click(laterButton());
    expect(visibleMonths()).toEqual(['2026-11', '2026-12', '2027-01']);

    // Stepping back from the clamped page is deliberately asymmetric: the
    // clamp only shifted the cursor forward by one month (not a full page),
    // so a full page-back lands one month earlier than the page we came from.
    await user.click(earlierButton());
    expect(visibleMonths()).toEqual(['2026-08', '2026-09', '2026-10']);
  });

  it('disables each arrow at its bound', async () => {
    const user = userEvent.setup();
    renderCalendar(LONG_START, LONG_END);

    expect(earlierButton()).toBeDisabled();
    expect(laterButton()).toBeEnabled();

    for (let i = 0; i < 4; i += 1) {
      await user.click(laterButton());
    }

    expect(visibleMonths()).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(laterButton()).toBeDisabled();
    expect(earlierButton()).toBeEnabled();
  });
});

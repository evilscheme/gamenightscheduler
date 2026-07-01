'use client';

import { useReducer } from 'react';
import { Button, EyebrowLabel, HintText, Input, Panel, Textarea, ToggleSwitch } from '@/components/ui';
import {
  DAY_OPTIONS,
  SCHEDULING_WINDOW_OPTIONS,
  TEXT_LIMITS,
  TIMEZONE_GROUPS,
  USAGE_LIMITS,
} from '@/lib/constants';
import { useUserPreferences } from '@/hooks/useUserPreferences';

export interface GameFormState {
  name: string;
  description: string;
  playDays: number[];
  adHocOnly: boolean;
  windowMonths: number;
  defaultStartTime: string;
  defaultEndTime: string;
  timezone: string;
  useCustomStart: boolean;
  useCustomEnd: boolean;
  campaignStartDate: string;
  campaignEndDate: string;
  minPlayersNeeded: number;
}

type FormAction =
  | { type: 'set'; patch: Partial<GameFormState> }
  | { type: 'toggleDay'; day: number };

function reducer(state: GameFormState, action: FormAction): GameFormState {
  if (action.type === 'set') return { ...state, ...action.patch };
  if (action.type === 'toggleDay') {
    const next = state.playDays.includes(action.day)
      ? state.playDays.filter((d) => d !== action.day)
      : [...state.playDays, action.day];
    return { ...state, playDays: next };
  }
  return state;
}

export interface GameFormProps {
  mode: 'create' | 'edit';
  initial: GameFormState;
  busy: boolean;
  /** Optional informational message shown above Schedule (used by edit mode for ad-hoc conversion notice). */
  noticeMessage?: string | null;
  /** Optional reason the submit button is disabled (e.g. at game limit). Rendered as a hint below the submit button, in addition to disabling it. */
  disabledReason?: string | null;
  /** Validation/submission error rendered above the submit button. */
  error?: string;
  onSubmit: (state: GameFormState) => Promise<void> | void;
  onCancel: () => void;
}

const inputClass =
  'w-full px-3 py-2 border border-border rounded-lg shadow-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring';

export function GameForm({
  mode,
  initial,
  busy,
  noticeMessage,
  disabledReason,
  error,
  onSubmit,
  onCancel,
}: GameFormProps) {
  const { weekStartDay } = useUserPreferences();
  const [state, dispatch] = useReducer(reducer, initial);

  const orderedDayOptions =
    weekStartDay === 0
      ? DAY_OPTIONS
      : [...DAY_OPTIONS.slice(weekStartDay), ...DAY_OPTIONS.slice(0, weekStartDay)];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    return onSubmit(state);
  };

  const submitLabel =
    mode === 'create'
      ? busy
        ? 'Creating...'
        : 'Create Game'
      : busy
        ? 'Saving...'
        : 'Save Changes';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* ── Identity ─────────────────────────────────────────────────── */}
      <Panel as="section" padded="md">
        <EyebrowLabel className="mb-4 block">Identity</EyebrowLabel>
        <div className="space-y-6">
          <Input
            label="Game Name"
            value={state.name}
            onChange={(e) => dispatch({ type: 'set', patch: { name: e.target.value } })}
            placeholder="e.g., Friday Night Board Games"
            maxLength={TEXT_LIMITS.GAME_NAME}
            required
          />
          <Textarea
            label="Description (optional)"
            value={state.description}
            onChange={(e) => dispatch({ type: 'set', patch: { description: e.target.value } })}
            placeholder="A brief description of your game..."
            maxLength={TEXT_LIMITS.GAME_DESCRIPTION}
            rows={3}
          />
        </div>
      </Panel>

      {/* ── Schedule ─────────────────────────────────────────────────── */}
      <Panel as="section" padded="md">
        <EyebrowLabel className="mb-4 block">Schedule</EyebrowLabel>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <ToggleSwitch
              checked={state.adHocOnly}
              onChange={(next) =>
                dispatch({ type: 'set', patch: { adHocOnly: next, ...(next ? { playDays: [] } : {}) } })
              }
              ariaLabel="Ad-hoc scheduling only"
            />
            <div>
              <label className="text-sm font-medium text-foreground">
                Ad-hoc scheduling only
              </label>
              <p className="text-sm text-muted-foreground">
                No fixed play days &mdash; schedule sessions on any date
              </p>
            </div>
          </div>

          {state.adHocOnly && (
            <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
              <p className="text-sm text-warning">
                {mode === 'create'
                  ? 'No dates will appear on the calendar automatically. You’ll need to add each potential play date manually from the game calendar using the + button.'
                  : 'With ad-hoc scheduling, players mark availability on specific dates added by the GM from the calendar. No recurring play days are needed.'}
              </p>
            </div>
          )}

          {noticeMessage && (
            <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
              <p className="text-sm text-primary">{noticeMessage}</p>
            </div>
          )}

          {!state.adHocOnly && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                Which days can your group play?
              </label>
              <div className="flex flex-wrap gap-2">
                {orderedDayOptions.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    aria-pressed={state.playDays.includes(day.value)}
                    onClick={() => dispatch({ type: 'toggleDay', day: day.value })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      state.playDays.includes(day.value)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {mode === 'create'
                  ? 'Players mark availability on these days. You can add special one-off dates later.'
                  : 'Players mark availability on these days. You can add special one-off dates from the calendar.'}
              </p>
            </div>
          )}

          <div>
            <label htmlFor="scheduling-window" className="block text-sm font-medium text-foreground mb-1">
              Scheduling Window
            </label>
            <select
              id="scheduling-window"
              value={state.windowMonths}
              onChange={(e) => dispatch({ type: 'set', patch: { windowMonths: Number(e.target.value) } })}
              className={inputClass}
            >
              {SCHEDULING_WINDOW_OPTIONS.map((months) => (
                <option key={months} value={months}>
                  {months} {months === 1 ? 'month' : 'months'} ahead
                </option>
              ))}
            </select>
            <p className="text-sm text-muted-foreground mt-1">
              How far in advance players can mark their availability
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-foreground">Campaign Dates</label>

            <div className="flex items-center gap-3">
              <ToggleSwitch
                checked={state.useCustomStart}
                onChange={(next) =>
                  dispatch({
                    type: 'set',
                    patch: { useCustomStart: next, ...(next ? {} : { campaignStartDate: '' }) },
                  })
                }
                ariaLabel="Custom start date"
              />
              <div>
                <label className="text-sm text-foreground">Custom start date</label>
                <p className="text-xs text-muted-foreground">
                  {state.useCustomStart ? 'Calendar starts on this date' : 'Starts immediately'}
                </p>
              </div>
            </div>
            {state.useCustomStart && (
              <input
                type="date"
                id="campaign-start"
                value={state.campaignStartDate}
                onChange={(e) => dispatch({ type: 'set', patch: { campaignStartDate: e.target.value } })}
                className={inputClass}
              />
            )}

            <div className="flex items-center gap-3">
              <ToggleSwitch
                checked={state.useCustomEnd}
                onChange={(next) =>
                  dispatch({
                    type: 'set',
                    patch: { useCustomEnd: next, ...(next ? {} : { campaignEndDate: '' }) },
                  })
                }
                ariaLabel="Custom end date"
              />
              <div>
                <label className="text-sm text-foreground">Custom end date</label>
                <p className="text-xs text-muted-foreground">
                  {state.useCustomEnd ? 'Calendar ends on this date' : 'Runs indefinitely'}
                </p>
              </div>
            </div>
            {state.useCustomEnd && (
              <input
                type="date"
                id="campaign-end"
                value={state.campaignEndDate}
                min={state.campaignStartDate || undefined}
                onChange={(e) => dispatch({ type: 'set', patch: { campaignEndDate: e.target.value } })}
                className={inputClass}
              />
            )}
          </div>
        </div>
      </Panel>

      {/* ── Sessions ─────────────────────────────────────────────────── */}
      <Panel as="section" padded="md">
        <EyebrowLabel className="mb-4 block">Sessions</EyebrowLabel>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              Default Session Time
            </label>
            <div className="flex gap-4">
              <div className="flex-1">
                <label htmlFor="default-start-time" className="block text-sm text-muted-foreground mb-1">
                  Start Time
                </label>
                <input
                  id="default-start-time"
                  type="time"
                  value={state.defaultStartTime}
                  onChange={(e) => dispatch({ type: 'set', patch: { defaultStartTime: e.target.value } })}
                  className={inputClass}
                />
              </div>
              <div className="flex-1">
                <label htmlFor="default-end-time" className="block text-sm text-muted-foreground mb-1">
                  End Time
                </label>
                <input
                  id="default-end-time"
                  type="time"
                  value={state.defaultEndTime}
                  onChange={(e) => dispatch({ type: 'set', patch: { defaultEndTime: e.target.value } })}
                  className={inputClass}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Default times used when scheduling sessions
            </p>
          </div>

          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-foreground mb-1">
              Timezone
            </label>
            <select
              id="timezone"
              value={state.timezone}
              onChange={(e) => dispatch({ type: 'set', patch: { timezone: e.target.value } })}
              className={inputClass}
            >
              {TIMEZONE_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="text-sm text-muted-foreground mt-1">
              Used for calendar exports so events appear at the correct time
            </p>
          </div>

          {mode === 'edit' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Minimum Players Needed
              </label>
              <input
                type="number"
                min="0"
                max={USAGE_LIMITS.MAX_PLAYERS_PER_GAME}
                value={state.minPlayersNeeded}
                onChange={(e) =>
                  dispatch({
                    type: 'set',
                    patch: {
                      minPlayersNeeded: Math.max(
                        0,
                        Math.min(USAGE_LIMITS.MAX_PLAYERS_PER_GAME, parseInt(e.target.value) || 0),
                      ),
                    },
                  })
                }
                className={inputClass}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Dates with fewer available players will be ranked lower. Set to 0 to disable.
              </p>
            </div>
          )}
        </div>
      </Panel>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-4 pt-2">
        <Button type="submit" disabled={busy || !!disabledReason} className="flex-1">
          {submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
      {disabledReason && <HintText>{disabledReason}</HintText>}
    </form>
  );
}

/**
 * What the game detail page should render for a given load outcome.
 *
 * `error` and `not-found` are deliberately separate. RLS reports "you are not a
 * participant" by returning zero rows, which is genuinely indistinguishable
 * from "this game does not exist" — both are `not-found`, and both should send
 * the player back to the dashboard. A query that *failed* is a third thing: it
 * tells us nothing about whether the game exists, so bouncing the player (and
 * landing them on a dashboard whose queries failed the same way, showing an
 * empty game list) reads as data loss. Errors stay put and offer a retry.
 */
export type GameLoadState = 'loading' | 'error' | 'not-found' | 'ready';

export function resolveGameLoadState(args: {
  authLoading: boolean;
  gameLoading: boolean;
  gameErrored: boolean;
  hasGame: boolean;
}): GameLoadState {
  const { authLoading, gameLoading, gameErrored, hasGame } = args;
  // Checked first so an in-flight retry after a failed attempt keeps showing
  // the spinner rather than flashing an error the retry is about to clear.
  if (authLoading || gameLoading) return 'loading';
  if (gameErrored) return 'error';
  if (!hasGame) return 'not-found';
  return 'ready';
}

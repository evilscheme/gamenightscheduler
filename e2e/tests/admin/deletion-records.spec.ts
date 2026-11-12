import { test, expect, type Page } from '@playwright/test';
import { addDays, format } from 'date-fns';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { addPlayerToGame, createTestGame, createTestSession, getAdminClient, setAvailability } from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

// Deletion records hold no ids — that's the point of them — so a test can't look
// its own record up by game or user. Each test instead plants a date nobody
// else will pick (a random day in the 1990s–2010s) as the row's created/joined
// timestamp and finds the record that carries it.
function plantedDay(): string {
  const day = Date.UTC(1990, 0, 1) + Math.floor(Math.random() * 365 * 25) * 86_400_000;
  return new Date(day).toISOString().slice(0, 10); // UTC on purpose: the trigger stores UTC days
}

const noon = (day: string) => `${day}T12:00:00Z`;

/** A date `offset` days from today — far enough either way that no timezone moves it across "today". */
const dayFromNow = (offset: number) => format(addDays(new Date(), offset), 'yyyy-MM-dd');

interface RecordRow {
  entity: string;
  cascaded: boolean;
  actor: string | null;
  xact: number | null;
  details: Record<string, unknown> | null;
}

async function recordsWith(entity: string, key: 'created' | 'joined', day: string): Promise<RecordRow[]> {
  const { data, error } = await getAdminClient()
    .from('deletion_log')
    .select('entity, cascaded, actor, xact, details')
    .eq('entity', entity)
    .eq(`details->>${key}`, day);
  expect(error).toBeNull();
  return (data ?? []) as RecordRow[];
}

async function backdate(table: 'users' | 'games', id: string, day: string) {
  const { error } = await getAdminClient().from(table).update({ created_at: noon(day) }).eq('id', id);
  expect(error).toBeNull();
}

async function backdateJoin(gameId: string, userId: string, day: string) {
  const { error } = await getAdminClient()
    .from('game_memberships')
    .update({ joined_at: noon(day) })
    .eq('game_id', gameId)
    .eq('user_id', userId);
  expect(error).toBeNull();
}

async function newUser(request: Parameters<typeof createTestUser>[0], slug: string, name: string) {
  return createTestUser(request, {
    email: `${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@e2e.local`,
    name,
    is_gm: true,
  });
}

const login = (page: Page, user: { email: string; name: string }, is_admin = false) =>
  loginTestUser(page, { email: user.email, name: user.name, is_gm: true, is_admin });

test.describe('Deletion records', () => {
  test('deleting a game records what the game was, and its children as cascaded', async ({ page, request }) => {
    const gm = await newUser(request, 'delrec-game-gm', 'Record Game GM');
    const player = await newUser(request, 'delrec-game-player', 'Record Game Player');
    const game = await createTestGame({ gm_id: gm.id, name: 'Record Facts Game' });
    const gameDay = plantedDay();
    const joinDay = plantedDay();
    await backdate('games', game.id, gameDay);
    await addPlayerToGame(game.id, player.id);
    await backdateJoin(game.id, player.id, joinDay);
    await createTestSession({ game_id: game.id, date: dayFromNow(-30), confirmed_by: gm.id });
    await createTestSession({ game_id: game.id, date: dayFromNow(30), confirmed_by: gm.id });
    await setAvailability(player.id, game.id, [
      { date: dayFromNow(30), status: 'available' },
      { date: dayFromNow(37), status: 'maybe' },
    ]);

    await login(page, gm);
    await page.goto(`/games/${game.id}/edit`);
    await page.getByRole('button', { name: /delete game/i }).click({ timeout: TEST_TIMEOUTS.LONG });
    await page.getByRole('dialog', { name: /delete game/i }).getByRole('button', { name: /^delete game$/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: TEST_TIMEOUTS.LONG });

    const games = await recordsWith('game', 'created', gameDay);
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({
      cascaded: false,
      actor: 'gm',
      details: {
        created: gameDay,
        players: 2,
        sessions_past: 1,
        sessions_upcoming: 1,
        availability_entries: 2,
        extra_dates: 0,
      },
    });
    // Counted before the cascade ran — and nothing in the record says which game it was.
    expect(JSON.stringify(games[0])).not.toContain(game.id);
    expect(JSON.stringify(games[0])).not.toContain('Record Facts Game');

    // The player didn't leave: their membership went with the game, in the same transaction.
    const memberships = await recordsWith('membership', 'joined', joinDay);
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({ cascaded: true, xact: games[0].xact });
  });

  test('a player leaving is recorded apart from a player being removed', async ({ page, browser, request }) => {
    const gm = await newUser(request, 'delrec-leave-gm', 'Record Leave GM');
    const leaver = await newUser(request, 'delrec-leaver', 'Record Leaver');
    const removed = await newUser(request, 'delrec-removed', 'Record Removed');
    const game = await createTestGame({ gm_id: gm.id, name: 'Record Departure Game' });
    const leftDay = plantedDay();
    const removedDay = plantedDay();
    await addPlayerToGame(game.id, leaver.id);
    await addPlayerToGame(game.id, removed.id);
    await backdateJoin(game.id, leaver.id, leftDay);
    await backdateJoin(game.id, removed.id, removedDay);
    await setAvailability(leaver.id, game.id, [{ date: dayFromNow(30), status: 'available' }]);

    await login(page, leaver);
    await page.goto(`/games/${game.id}`);
    await page.getByRole('button', { name: /leave game/i }).click({ timeout: TEST_TIMEOUTS.LONG });
    await page.getByRole('dialog', { name: /leave game/i }).getByRole('button', { name: /^leave game$/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: TEST_TIMEOUTS.LONG });

    const gmContext = await browser.newContext();
    const gmPage = await gmContext.newPage();
    await login(gmPage, gm);
    await gmPage.goto(`/games/${game.id}`);
    const row = gmPage.locator('[data-testid="players-list"]').locator('li').filter({ hasText: 'Record Removed' });
    await row.getByLabel('Player actions').click({ timeout: TEST_TIMEOUTS.LONG });
    await gmPage.getByRole('button', { name: /remove from game/i }).click();
    await gmPage.getByRole('button', { name: /^remove player$/i }).click();
    await expect(gmPage.getByText('Players (1)')).toBeVisible({ timeout: TEST_TIMEOUTS.DEFAULT });
    await gmContext.close();

    const left = await recordsWith('membership', 'joined', leftDay);
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({
      cascaded: false,
      actor: 'self',
      details: { joined: leftDay, co_gm: false, availability_entries: 1 },
    });

    const kicked = await recordsWith('membership', 'joined', removedDay);
    expect(kicked).toHaveLength(1);
    expect(kicked[0]).toMatchObject({ cascaded: false, actor: 'gm' });
  });

  test('deleting an account ties its games to it, and a transferred game is not a departure', async ({ page, request }) => {
    const gm = await newUser(request, 'delrec-account-gm', 'Record Account GM');
    const heir = await newUser(request, 'delrec-heir', 'Record Heir');
    const accountDay = plantedDay();
    const soloGameDay = plantedDay();
    const heirJoinDay = plantedDay();
    await backdate('users', gm.id, accountDay);

    // One game nobody else is in (it goes with the account) and one to hand over.
    const solo = await createTestGame({ gm_id: gm.id, name: 'Record Solo Game' });
    await backdate('games', solo.id, soloGameDay);
    const handedOver = await createTestGame({ gm_id: gm.id, name: 'Record Handed Over Game' });
    await addPlayerToGame(handedOver.id, heir.id);
    await backdateJoin(handedOver.id, heir.id, heirJoinDay);

    await login(page, gm);
    await page.goto('/settings/delete-account');
    await expect(page.getByText('Games with other players')).toBeVisible({ timeout: TEST_TIMEOUTS.LONG });
    await page.getByRole('radio', { name: /transfer to another player/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByLabel(/type delete to confirm/i).fill('DELETE');
    await page.getByRole('button', { name: /permanently delete my account/i }).click({ force: true });
    await expect(page).toHaveURL(/\/login/, { timeout: TEST_TIMEOUTS.LONG });

    const accounts = await recordsWith('user', 'created', accountDay);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      cascaded: false,
      actor: 'system',
      // The handed-over game was no longer theirs by the time the account went.
      details: { created: accountDay, games_hosted: 1, games_joined: 0 },
    });

    const games = await recordsWith('game', 'created', soloGameDay);
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({ cascaded: true, xact: accounts[0].xact, details: { players: 1 } });

    // The heir became the host. Their membership row is gone, but nobody left.
    const { data: game } = await getAdminClient().from('games').select('gm_id').eq('id', handedOver.id).single();
    expect(game?.gm_id).toBe(heir.id);
    expect(await recordsWith('membership', 'joined', heirJoinDay)).toEqual([]);
  });

  test('the admin Deletions tab lists recent deletions with their facts', async ({ page, request }) => {
    const admin = await newUser(request, 'delrec-admin', 'Record Admin');
    const { error } = await getAdminClient()
      .from('deletion_log')
      .insert([
        {
          entity: 'game',
          cascaded: false,
          actor: 'gm',
          xact: 1,
          details: {
            created: format(addDays(new Date(), -400), 'yyyy-MM-dd'),
            players: 6,
            sessions_past: 12,
            sessions_upcoming: 2,
            availability_entries: 4321, // a count no other record will show
            extra_dates: 0,
            last_activity: format(addDays(new Date(), -2), 'yyyy-MM-dd'),
          },
        },
        // A record from before facts were kept.
        { entity: 'user', cascaded: false },
      ]);
    expect(error).toBeNull();

    await login(page, admin, true);
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Deletions', exact: true }).click({ timeout: TEST_TIMEOUTS.LONG });
    await expect(page.getByRole('heading', { name: 'Recent Deletions', exact: true })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    const records = page.getByTestId('deletion-record');
    const game = records.filter({ hasText: '4321 availability entries' });
    await expect(game).toHaveCount(1);
    await expect(game).toContainText('Game');
    await expect(game).toContainText('13 months old');
    await expect(game).toContainText('6 players');
    await expect(game).toContainText('12 past sessions, 2 upcoming');
    await expect(game).toContainText('Booked');

    await expect(records.filter({ hasText: 'No details recorded' }).first()).toContainText('Account');
  });
});

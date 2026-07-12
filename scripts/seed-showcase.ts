/**
 * Seed a rich, real-named "showcase" game into the LOCAL Supabase for marketing
 * screenshots (availability calendar + scheduling suggestions on the splash page).
 *
 * The group plays Thu–Sun with occasional ad-hoc one-shots, so the calendar looks
 * alive and the scheduler has a meaty set of candidate nights to rank.
 *
 * Idempotent + deterministic: re-running wipes and recreates the same game/data
 * (availability is generated from a seeded PRNG, so the calendar is reproducible).
 *
 * Run against LOCAL Supabase only:
 *   npx tsx scripts/seed-showcase.ts
 *
 * All dates are relative to today, so the game is always freshly populated. Set
 * SEED_TODAY=YYYY-MM-DD to simulate a different run date (handy for verifying the
 * calendar stays well-populated months from now).
 *
 * Then log in at http://localhost:3000/dev-login as "Withers" (the DM) and open
 * the game — its id/url is printed at the end.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

if (!SUPABASE_URL.includes('localhost') && !SUPABASE_URL.includes('127.0.0.1')) {
  console.error(`Refusing to seed: ${SUPABASE_URL} is not local Supabase.`);
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Deterministic RNG (mulberry32) so re-runs reproduce the same calendar.
// ---------------------------------------------------------------------------
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length)];

// ---------------------------------------------------------------------------
// Local-date helpers (never use toISOString().split — that shifts to UTC).
// ---------------------------------------------------------------------------
function toLocalDate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}
const addDays = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
// Last day of the month `months` after `from` — matches the app's eligible scheduling
// window, which runs through the end of the target month.
const endOfMonthsAhead = (from: Date, months: number): Date =>
  new Date(from.getFullYear(), from.getMonth() + months + 1, 0, 12, 0, 0);

// ---------------------------------------------------------------------------
// People — real names; the UI renders initials avatars from the name.
// ---------------------------------------------------------------------------
interface Person {
  key: string;
  email: string;
  name: string;
  is_gm: boolean;
  id?: string;
}
// Party roster: iconic Baldur's Gate 3 companions, DM'd by Withers.
const GM: Person = { key: 'withers', email: 'dev-showcase@dev.local', name: 'Withers', is_gm: true };
const PLAYERS: Person[] = [
  { key: 'astarion', email: 'astarion@players.local', name: 'Astarion', is_gm: false },
  { key: 'shadowheart', email: 'shadowheart@players.local', name: 'Shadowheart', is_gm: false },
  { key: 'gale', email: 'gale@players.local', name: 'Gale', is_gm: false },
  { key: 'laezel', email: 'laezel@players.local', name: "Lae'zel", is_gm: false },
  { key: 'karlach', email: 'karlach@players.local', name: 'Karlach', is_gm: false },
];
const ALL = [GM, ...PLAYERS];

async function upsertUser(p: Person): Promise<string> {
  const { data: created, error } = await admin.auth.admin.createUser({
    email: p.email,
    password: 'showcase-password-123!',
    email_confirm: true,
    user_metadata: { full_name: p.name },
  });

  let id: string;
  if (error) {
    if (!error.message?.toLowerCase().includes('already')) {
      throw new Error(`createUser(${p.email}) failed: ${error.message}`);
    }
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = list?.users.find((u) => u.email === p.email);
    if (!existing) throw new Error(`User ${p.email} reported as existing but not found`);
    id = existing.id;
  } else {
    id = created.user!.id;
  }

  const { error: upErr } = await admin.from('users').upsert({
    id,
    email: p.email,
    name: p.name,
    is_gm: p.is_gm,
    is_admin: false,
    timezone: 'America/Los_Angeles',
    time_format: '12h',
    week_start_day: 0,
  });
  if (upErr) throw new Error(`upsert profile ${p.email} failed: ${upErr.message}`);
  return id;
}

// ---------------------------------------------------------------------------
// Availability profiles. Weekdays: Thu=4, Fri=5, Sat=6, Sun=0.
// Each player leans toward certain days; 'pendingBoost' models responsiveness.
// ---------------------------------------------------------------------------
type Lean = 'good' | 'ok' | 'bad';
interface Profile {
  lean: Record<number, Lean>;
  pendingBoost: number; // extra chance a would-be answer stays blank
  // Optional per-weekday time window applied to "available" marks.
  after?: Partial<Record<number, string>>;
  until?: Partial<Record<number, string>>;
}
const PROFILES: Record<string, Profile> = {
  // Withers (DM): weekend-heavy, utterly reliable.
  withers: { lean: { 4: 'ok', 5: 'good', 6: 'good', 0: 'good' }, pendingBoost: 0 },
  // Astarion: night owl who comes alive after dark; chaotic about responding.
  astarion: {
    lean: { 4: 'ok', 5: 'good', 6: 'good', 0: 'ok' },
    pendingBoost: 0.13,
    after: { 5: '19:30', 6: '19:30' },
  },
  // Shadowheart: flexible and dependable.
  shadowheart: { lean: { 4: 'good', 5: 'good', 6: 'ok', 0: 'ok' }, pendingBoost: 0.04 },
  // Gale: homebody wizard — almost always free, quickest to answer.
  gale: { lean: { 4: 'good', 5: 'good', 6: 'good', 0: 'good' }, pendingBoost: 0.02 },
  // Lae'zel: disciplined — weeknights fine, keeps to a schedule, weekends are for training.
  laezel: { lean: { 4: 'good', 5: 'ok', 6: 'bad', 0: 'bad' }, pendingBoost: 0.06, until: { 4: '21:30' } },
  // Karlach: high energy, hard stops (that infernal engine); least consistent responder.
  karlach: { lean: { 4: 'ok', 5: 'ok', 6: 'ok', 0: 'ok' }, pendingBoost: 0.22, until: { 5: '22:30', 6: '22:30', 0: '22:00' } },
};

type Code = 'A' | 'U' | 'M' | '';
interface Mark {
  code: Code;
  after?: string;
  until?: string;
  comment?: string;
}
const UNAVAIL_COMMENTS = ['Out of town', 'Work trip', 'Family thing', 'Under the weather', 'Prior commitment'];
const MAYBE_COMMENTS = ['Depends on the week', 'Tentative — will confirm', 'Should know closer to the date', 'Might be able to swing it'];

// Cumulative [A, M, U] thresholds by lean (remainder => pending).
const DIST: Record<Lean, [number, number, number]> = {
  good: [0.72, 0.87, 0.94],
  ok: [0.45, 0.66, 0.86],
  bad: [0.12, 0.28, 0.74],
};

function rollMark(person: Person, weekday: number, rng: () => number): Mark {
  const prof = PROFILES[person.key];
  const lean = prof.lean[weekday] ?? 'ok';
  const [aT, mT, uT] = DIST[lean];
  const r = rng();
  let code: Code;
  if (r < aT) code = 'A';
  else if (r < mT) code = 'M';
  else if (r < uT) code = 'U';
  else code = '';
  // Responsiveness: sometimes an intended answer never gets entered.
  if (code !== '' && rng() < prof.pendingBoost) code = '';
  if (code === '') return { code: '' };

  const mark: Mark = { code };
  if (code === 'A') {
    if (prof.after?.[weekday]) mark.after = prof.after[weekday];
    if (prof.until?.[weekday]) mark.until = prof.until[weekday];
    if (rng() < 0.12) mark.comment = pick(rng, ['In!', 'Ready to roll 🎲', 'Locking it in']);
  } else if (code === 'M') {
    if (rng() < 0.5) mark.comment = pick(rng, MAYBE_COMMENTS);
  } else if (code === 'U') {
    if (rng() < 0.55) mark.comment = pick(rng, UNAVAIL_COMMENTS);
  }
  return mark;
}

// Remove demo player accounts from earlier roster versions (e.g. a rename) so the
// local DB doesn't accumulate orphaned @players.local users.
async function cleanupStalePlayers() {
  const keep = new Set(PLAYERS.map((p) => p.email));
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let removed = 0;
  for (const usr of list?.users ?? []) {
    if (usr.email?.endsWith('@players.local') && !keep.has(usr.email)) {
      await admin.from('users').delete().eq('id', usr.id);
      await admin.auth.admin.deleteUser(usr.id);
      removed++;
    }
  }
  if (removed) console.log(`✓ cleaned up ${removed} stale demo player(s)`);
}

async function main() {
  console.log(`Seeding showcase data into ${SUPABASE_URL} ...`);

  // 1. People
  await cleanupStalePlayers();
  for (const p of ALL) p.id = await upsertUser(p);
  console.log(`✓ ${ALL.length} users ready (${ALL.map((p) => p.name).join(', ')})`);

  // 2. Fresh game (delete-by-invite-code cascades to all child rows)
  const INVITE = 'strahd-showcase';
  const PLAY_DAYS = [4, 5, 6, 0]; // Thu, Fri, Sat, Sun
  const SCHEDULING_WINDOW_MONTHS = 2;
  await admin.from('games').delete().eq('invite_code', INVITE);
  const { data: game, error: gameErr } = await admin
    .from('games')
    .insert({
      name: 'Curse of Strahd',
      description: 'D&D 5e campaign — the mists of Barovia await. We aim for Thu–Sun; Roll20 + Discord voice.',
      gm_id: GM.id!,
      invite_code: INVITE,
      play_days: PLAY_DAYS,
      scheduling_window_months: SCHEDULING_WINDOW_MONTHS,
      min_players_needed: 4,
      default_start_time: '18:00',
      default_end_time: '22:00',
      timezone: 'America/Los_Angeles',
      ad_hoc_only: false,
    })
    .select()
    .single();
  if (gameErr || !game) throw new Error(`create game failed: ${gameErr?.message}`);
  console.log(`✓ game "${game.name}" (${game.id}) — play days Thu–Sun`);

  // 3. Memberships
  await admin.from('game_memberships').insert(PLAYERS.map((p) => ({ game_id: game.id, user_id: p.id! })));
  console.log(`✓ ${PLAYERS.length} players joined`);

  // 4. Dates — all relative to "today", so the game is always freshly populated.
  //    Set SEED_TODAY=YYYY-MM-DD to simulate a different run date (e.g. for testing).
  const today = process.env.SEED_TODAY ? new Date(`${process.env.SEED_TODAY}T12:00:00`) : new Date();
  today.setHours(12, 0, 0, 0);
  if (Number.isNaN(today.getTime())) throw new Error(`Invalid SEED_TODAY: ${process.env.SEED_TODAY}`);

  // The app's eligible window runs through the end of the target month; generate a
  // little past it (out-of-window dates simply won't render) to cover the edge.
  const windowEnd = endOfMonthsAhead(today, SCHEDULING_WINDOW_MONTHS);
  const genEnd = addDays(windowEnd, 10);

  const playDates: string[] = [];
  for (let d = addDays(today, 1); d <= genEnd; d = addDays(d, 1)) {
    if (PLAY_DAYS.includes(d.getDay())) playDates.push(toLocalDate(d));
  }
  const firstOfDay = (wd: number) => {
    for (let d = addDays(today, 1); d <= genEnd; d = addDays(d, 1)) if (d.getDay() === wd) return toLocalDate(d);
    return null;
  };
  const heroFri = firstOfDay(5)!; // full-house Friday -> the standout suggestion
  const nextSat = firstOfDay(6)!; // confirmed upcoming session

  // Most recent past Saturday (for a past session + its availability history).
  let pastSat = addDays(today, -1);
  while (pastSat.getDay() !== 6) pastSat = addDays(pastSat, -1);
  const pastSatStr = toLocalDate(pastSat);

  // Ad-hoc one-shots on non-play weekdays, placed as fractions of the eligible window
  // so they always land as visible suggestions no matter when the seed runs.
  const windowDays = Math.round((windowEnd.getTime() - today.getTime()) / 86_400_000);
  const adHocOn = (weekday: number, fraction: number): string => {
    let d = addDays(today, Math.max(2, Math.round(windowDays * fraction)));
    while (d.getDay() !== weekday) d = addDays(d, 1);
    if (d > windowEnd) d = addDays(d, -7); // snapped past the edge -> pull back a week
    return toLocalDate(d);
  };
  const adHoc: { date: string; note: string }[] = [
    { date: adHocOn(2, 0.1), note: 'Session 0: Tarokka reading & character intros' }, // Tuesday, early
    { date: adHocOn(3, 0.45), note: 'Midweek bonus: the Death House flashback' }, // Wednesday, mid-window
    { date: adHocOn(1, 0.78), note: 'Holiday all-day marathon 🎲' }, // Monday, later
  ];

  await admin
    .from('game_play_dates')
    .insert(adHoc.map((x) => ({ game_id: game.id, date: x.date, note: x.note })));
  console.log(`✓ ${adHoc.length} ad-hoc dates (${adHoc.map((x) => x.date).join(', ')})`);

  // 5. Availability
  const rows: Record<string, unknown>[] = [];
  const push = (userId: string, date: string, mk: Mark) => {
    if (mk.code === '') return;
    rows.push({
      user_id: userId,
      game_id: game.id,
      date,
      status: mk.code === 'A' ? 'available' : mk.code === 'U' ? 'unavailable' : 'maybe',
      comment: mk.comment ?? null,
      available_after: mk.after ?? null,
      available_until: mk.until ?? null,
    });
  };
  const rngFor = (p: Person) => makeRng(0x5721 + ALL.indexOf(p) * 1013);

  for (const p of ALL) {
    const rng = rngFor(p);
    const prof = PROFILES[p.key];

    // Regular play dates via profile.
    for (const date of playDates) {
      const wd = new Date(`${date}T12:00:00`).getDay();
      push(p.id!, date, rollMark(p, wd, rng));
    }

    // Hero Friday: everyone's in, a couple of time windows -> a clear top suggestion
    // (Astarion's 7pm start + Karlach's 10:30 hard stop = a tidy computed window).
    const heroMark: Mark = { code: 'A' };
    if (p.key === 'astarion') { heroMark.after = '19:00'; heroMark.comment = "Darling, I wouldn't miss it."; }
    if (p.key === 'karlach') { heroMark.until = '22:30'; heroMark.comment = "LET'S GO! 🔥"; }
    if (p.key === 'gale') heroMark.comment = "I'll bring snacks and a monologue.";
    if (p.key === 'laezel') heroMark.comment = 'At the appointed hour. No later.';
    upsertRow(rows, game.id, p.id!, heroFri, heroMark);

    // Confirmed upcoming Saturday: everyone was available.
    upsertRow(rows, game.id, p.id!, nextSat, { code: 'A', ...(prof.until?.[6] ? { until: prof.until[6] } : {}) });

    // Past Saturday session: everyone showed up.
    upsertRow(rows, game.id, p.id!, pastSatStr, { code: 'A' });

    // Ad-hoc dates: decent-but-varied turnout. The DM's always in; Astarion won't
    // do the ALL-DAY marathon (adHoc[2]) for, well, obvious reasons.
    for (const { date } of adHoc) {
      const r = rng();
      const code: Code = r < 0.6 ? 'A' : r < 0.78 ? 'M' : r < 0.9 ? 'U' : '';
      let mk: Mark = { code };
      if (p.key === 'astarion' && date === adHoc[2].date) mk = { code: 'U', comment: 'Not in this sun, thank you.' };
      if (p.key === 'withers') mk = { code: 'A' };
      upsertRow(rows, game.id, p.id!, date, mk);
    }
  }

  await admin.from('availability').upsert(rows, { onConflict: 'user_id,game_id,date' });
  console.log(`✓ ${rows.length} availability marks`);

  // 6. Sessions: one past, one upcoming (both weekends, well-attended).
  await admin.from('sessions').insert([
    {
      game_id: game.id,
      date: pastSatStr,
      status: 'confirmed',
      confirmed_by: GM.id!,
      start_time: '18:00',
      end_time: '22:00',
      location: 'Roll20 + Discord',
      notes: 'Ch. 2 — Death House behind us; the party reaches the village of Barovia.',
    },
    {
      game_id: game.id,
      date: nextSat,
      status: 'confirmed',
      confirmed_by: GM.id!,
      start_time: '18:00',
      end_time: '22:00',
      location: 'Roll20 + Discord',
      notes: 'Ch. 3 — Meeting the Burgomaster; rumors of Ireena.',
    },
  ]);
  console.log(`✓ 2 sessions (past ${pastSatStr}, next ${nextSat})`);

  console.log('\n─────────────────────────────────────────────');
  console.log('Showcase ready. To view:');
  console.log('  1. npm run dev:local');
  console.log('  2. open http://localhost:3000/dev-login  → click "Withers"');
  console.log(`  3. open http://localhost:3000/games/${game.id}`);
  console.log('─────────────────────────────────────────────');
}

// De-dupes against the profile-generated rows so the pinned dates win.
function upsertRow(
  rows: Record<string, unknown>[],
  gameId: string,
  userId: string,
  date: string,
  mk: Mark,
) {
  const idx = rows.findIndex((r) => r.user_id === userId && r.date === date);
  if (idx >= 0) rows.splice(idx, 1);
  if (mk.code === '') return;
  rows.push({
    user_id: userId,
    game_id: gameId,
    date,
    status: mk.code === 'A' ? 'available' : mk.code === 'U' ? 'unavailable' : 'maybe',
    comment: mk.comment ?? null,
    available_after: mk.after ?? null,
    available_until: mk.until ?? null,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

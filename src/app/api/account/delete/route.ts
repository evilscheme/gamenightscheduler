import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/api/auth';
import { serverError } from '@/lib/apiError';

interface GameAction {
  gameId: string;
  action: 'delete' | 'transfer';
  newGmId?: string;
}

interface DeleteRequest {
  gameActions: GameAction[];
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  let body: DeleteRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { gameActions = [] } = body;

  // Validate shape of each action
  for (const action of gameActions) {
    if (!action.gameId || typeof action.gameId !== 'string') {
      return NextResponse.json({ error: 'Each action must have a gameId' }, { status: 400 });
    }
    if (action.action !== 'delete' && action.action !== 'transfer') {
      return NextResponse.json({ error: 'Action must be "delete" or "transfer"' }, { status: 400 });
    }
    if (action.action === 'transfer') {
      if (!action.newGmId || typeof action.newGmId !== 'string') {
        return NextResponse.json({ error: 'Transfer action requires newGmId' }, { status: 400 });
      }
      if (action.newGmId === user.id) {
        return NextResponse.json({ error: 'Cannot transfer a game to yourself' }, { status: 400 });
      }
    }
  }

  const admin = createAdminClient();

  // Verify all specified game IDs are owned by this user
  if (gameActions.length > 0) {
    const gameIds = gameActions.map((a) => a.gameId);
    const { data: verifiedGames, error: verifyError } = await admin
      .from('games')
      .select('id')
      .eq('gm_id', user.id)
      .in('id', gameIds);

    if (verifyError) {
      return serverError(verifyError, { route: 'account/delete', step: 'verify-ownership' });
    }

    if ((verifiedGames?.length ?? 0) !== gameIds.length) {
      return NextResponse.json({ error: 'Invalid game IDs or not authorized' }, { status: 403 });
    }
  }

  // Fetch all owned games with member info to verify completeness of actions
  const { data: allOwnedGames, error: ownedError } = await admin
    .from('games')
    .select('id, game_memberships(user_id)')
    .eq('gm_id', user.id);

  if (ownedError) {
    return serverError(ownedError, { route: 'account/delete', step: 'fetch-owned-games' });
  }

  // Every game that has members must have an explicit action
  const providedGameIds = new Set(gameActions.map((a) => a.gameId));
  const gamesWithMembersNeedingAction = (allOwnedGames ?? []).filter(
    (g) => (g.game_memberships?.length ?? 0) > 0 && !providedGameIds.has(g.id)
  );

  if (gamesWithMembersNeedingAction.length > 0) {
    return NextResponse.json(
      { error: 'All games with members require a delete or transfer decision' },
      { status: 400 }
    );
  }

  // Verify each transfer target is a current member of the game
  const transferActions = gameActions.filter((a) => a.action === 'transfer');
  for (const action of transferActions) {
    const { data: membership, error: memberError } = await admin
      .from('game_memberships')
      .select('user_id')
      .eq('game_id', action.gameId)
      .eq('user_id', action.newGmId!)
      .maybeSingle();

    if (memberError) {
      return serverError(memberError, { route: 'account/delete', step: 'verify-transfer-target' });
    }
    if (!membership) {
      return NextResponse.json(
        { error: `Transfer target is not a member of game ${action.gameId}` },
        { status: 400 }
      );
    }
  }

  // --- Execute ---

  // 1. Process transfers: update gm_id, remove new GM's membership row
  for (const action of transferActions) {
    const { error: updateError } = await admin
      .from('games')
      .update({ gm_id: action.newGmId })
      .eq('id', action.gameId)
      .eq('gm_id', user.id); // safety: only update if still owned by this user

    if (updateError) {
      return serverError(updateError, {
        route: 'account/delete',
        step: 'transfer-game',
        gameId: action.gameId,
      });
    }

    // Remove the new GM from the membership table (they're now the owner, not a player)
    await admin
      .from('game_memberships')
      .delete()
      .eq('game_id', action.gameId)
      .eq('user_id', action.newGmId!);
  }

  // 2. Delete the auth user. public.users REFERENCES auth.users ON DELETE
  //    CASCADE, so this single delete cascades through the profile to:
  //    - All remaining owned games (those not transferred, including solo ones)
  //    - Their sessions, memberships, availability, play dates
  //    - User's own memberships in other games
  //    - User's own availability in other games
  //    - sessions.confirmed_by set to NULL (ON DELETE SET NULL)
  //    Deleting ONLY auth.users means a failure here leaves the account fully
  //    intact — no orphan window where the profile is gone but the login still
  //    works (the signup trigger only fires on INSERT, so a lost profile would
  //    never regenerate).
  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(user.id);

  if (deleteAuthError) {
    return serverError(deleteAuthError, {
      route: 'account/delete',
      step: 'delete-auth-user',
      userId: user.id,
    });
  }

  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface GameAction {
  gameId: string;
  action: 'delete' | 'transfer';
  newGmId?: string;
}

interface DeleteRequest {
  gameActions: GameAction[];
}

export async function POST(req: NextRequest): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

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
      return NextResponse.json({ error: 'Failed to verify game ownership' }, { status: 500 });
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
    return NextResponse.json({ error: 'Failed to fetch owned games' }, { status: 500 });
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
      return NextResponse.json({ error: 'Failed to verify transfer target' }, { status: 500 });
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
      console.error('delete: failed to transfer game', action.gameId, updateError);
      return NextResponse.json({ error: 'Failed to transfer game ownership' }, { status: 500 });
    }

    // Remove the new GM from the membership table (they're now the owner, not a player)
    await admin
      .from('game_memberships')
      .delete()
      .eq('game_id', action.gameId)
      .eq('user_id', action.newGmId!);
  }

  // 2. Delete public.users — cascades:
  //    - All remaining owned games (those not transferred, including solo ones)
  //    - Their sessions, memberships, availability, play dates
  //    - User's own memberships in other games
  //    - User's own availability in other games
  //    - sessions.confirmed_by set to NULL (ON DELETE SET NULL)
  const { error: deleteProfileError } = await admin
    .from('users')
    .delete()
    .eq('id', user.id);

  if (deleteProfileError) {
    console.error('delete: failed to delete user profile', deleteProfileError);
    return NextResponse.json({ error: 'Failed to delete user profile' }, { status: 500 });
  }

  // 3. Delete from auth.users (must come after public.users due to FK direction)
  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(user.id);

  if (deleteAuthError) {
    // Profile is already deleted — log for manual recovery but don't fail the response
    console.error('delete: profile deleted but auth user deletion failed', user.id, deleteAuthError);
    return NextResponse.json({ error: 'Failed to delete auth account' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

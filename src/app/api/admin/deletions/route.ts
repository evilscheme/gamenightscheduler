import { NextResponse } from 'next/server';
import { requireAdmin, paginate } from '@/lib/api/admin';
import { buildDeletionRecords, type DeletionLogRow } from '@/lib/admin';
import { serverError } from '@/lib/apiError';
import type { AdminDeletions } from '@/types/api';

/** How many deliberate deletions the Deletions tab lists. */
const LIMIT = 100;

export async function GET(): Promise<Response> {
  try {
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;
    const { admin } = result;

    // Where the list starts: the moment of the LIMIT-th newest deliberate
    // deletion, plus how many there have ever been.
    const newest = await admin
      .from('deletion_log')
      .select('deleted_at', { count: 'exact' })
      .eq('cascaded', false)
      .order('deleted_at', { ascending: false })
      .limit(LIMIT);
    if (newest.error) throw newest.error;
    const cutoff = newest.data.length === LIMIT ? newest.data[LIMIT - 1].deleted_at : undefined;

    // Everything from that moment on, cascaded rows included: an account's
    // games were deleted in its transaction, so they share its deleted_at and
    // can't fall outside the window. Paged, because one account deletion can
    // cascade through more rows than a single read returns.
    const rows = await paginate<DeletionLogRow>(
      admin,
      'deletion_log',
      'id, entity, cascaded, deleted_at, actor, xact, details',
      { dateColumn: 'deleted_at', cutoff }
    );

    const data: AdminDeletions = {
      records: buildDeletionRecords(rows, LIMIT).records,
      total: newest.count ?? rows.filter((r) => !r.cascaded).length,
    };
    return NextResponse.json(data);
  } catch (error) {
    return serverError(error, { route: '/api/admin/deletions' });
  }
}

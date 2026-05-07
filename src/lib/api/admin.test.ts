import { describe, it, expect, vi } from 'vitest';
import { paginate, type AdminClient } from './admin';

function makeMockClient(pages: unknown[][]) {
  let pageIndex = 0;
  const range = vi.fn().mockImplementation(() => {
    const data = pages[pageIndex] ?? [];
    pageIndex++;
    return Promise.resolve({ data });
  });
  const builder = {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    range,
  };
  const from = vi.fn().mockReturnValue(builder);
  return { client: { from } as unknown as AdminClient, builder, from };
}

describe('paginate', () => {
  it('returns rows for a single page', async () => {
    const { client } = makeMockClient([[{ id: 1 }, { id: 2 }]]);
    const result = await paginate<{ id: number }>(client, 'users', 'id', { pageSize: 1000 });
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('paginates across multiple pages until a short page is returned', async () => {
    const fullPage = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
    const partialPage = [{ id: 1000 }, { id: 1001 }];
    const { client, builder } = makeMockClient([fullPage, partialPage]);

    const result = await paginate<{ id: number }>(client, 'users', 'id');

    expect(result).toHaveLength(1002);
    expect(result[0]).toEqual({ id: 0 });
    expect(result[1001]).toEqual({ id: 1001 });
    expect(builder.range).toHaveBeenCalledTimes(2);
    expect(builder.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(builder.range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it('returns an empty array when the first page is empty', async () => {
    const { client, builder } = makeMockClient([[]]);
    const result = await paginate<{ id: number }>(client, 'users', 'id');
    expect(result).toEqual([]);
    expect(builder.range).toHaveBeenCalledTimes(1);
  });

  it('applies a date-column cutoff via gte when provided', async () => {
    const { client, builder } = makeMockClient([[{ id: 1 }]]);
    await paginate<{ id: number }>(client, 'users', 'id, created_at', {
      dateColumn: 'created_at',
      cutoff: '2025-01-01',
    });
    expect(builder.gte).toHaveBeenCalledWith('created_at', '2025-01-01');
  });

  it('does not call gte when cutoff is missing', async () => {
    const { client, builder } = makeMockClient([[{ id: 1 }]]);
    await paginate<{ id: number }>(client, 'users', 'id', { dateColumn: 'created_at' });
    expect(builder.gte).not.toHaveBeenCalled();
  });

  it('respects a custom pageSize', async () => {
    const { client, builder } = makeMockClient([[{ id: 1 }, { id: 2 }]]);
    await paginate<{ id: number }>(client, 'users', 'id', { pageSize: 50 });
    expect(builder.range).toHaveBeenCalledWith(0, 49);
  });
});

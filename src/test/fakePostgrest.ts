import { vi } from "vitest";

type Row = Record<string, unknown>;

/**
 * An in-memory stand-in for the slice of the PostgREST query builder the data
 * helpers use (select/eq/gte/lte/order/range). Unlike a chain of
 * `mockReturnThis()`, it actually applies filters, ordering and the
 * `max_rows` cap, so a test can assert a read is complete and duplicate-free.
 *
 * Without `.order()`, row order is unspecified in Postgres and can differ
 * between two queries. The fake makes that concrete: unordered reads come
 * back reversed on every other call, so offset paging without a total order
 * duplicates some rows and drops others, as it can in production.
 */
export function fakePostgrest(tables: Record<string, Row[]>, opts: { maxRows?: number } = {}) {
  const maxRows = opts.maxRows ?? 1000;
  let unorderedCalls = 0;

  const from = vi.fn((table: string) => {
    let rows = [...(tables[table] ?? [])];
    const orderBy: string[] = [];
    // Simple `alias:column` entries in the select list. Other columns aren't
    // projected: rows come back with every field, plus any aliases.
    let aliases: [alias: string, column: string][] = [];

    const builder = {
      select: vi.fn((columns?: string) => {
        aliases = (columns ?? '')
          .split(',')
          .map((c) => c.trim().match(/^(\w+):(\w+)$/))
          .filter((m): m is RegExpMatchArray => m !== null)
          .map((m) => [m[1], m[2]]);
        return builder;
      }),
      eq: vi.fn((col: string, v: unknown) => ((rows = rows.filter((r) => r[col] === v)), builder)),
      gt: vi.fn((col: string, v: string) => ((rows = rows.filter((r) => String(r[col]) > v)), builder)),
      gte: vi.fn((col: string, v: string) => ((rows = rows.filter((r) => String(r[col]) >= v)), builder)),
      lt: vi.fn((col: string, v: string) => ((rows = rows.filter((r) => String(r[col]) < v)), builder)),
      lte: vi.fn((col: string, v: string) => ((rows = rows.filter((r) => String(r[col]) <= v)), builder)),
      order: vi.fn((col: string) => (orderBy.push(col), builder)),
      range: vi.fn(async (start: number, end: number) => {
        let sorted = rows;
        if (orderBy.length > 0) {
          sorted = [...rows].sort((a, b) => {
            for (const col of orderBy) {
              const cmp = String(a[col]).localeCompare(String(b[col]));
              if (cmp !== 0) return cmp;
            }
            return 0;
          });
        } else if (unorderedCalls++ % 2 === 1) {
          sorted = [...rows].reverse();
        }
        const count = Math.min(end - start + 1, maxRows);
        const page = sorted.slice(start, start + count);
        // Like PostgREST, every response is fresh objects, never the stored rows.
        const data = page.map((r) => {
          const copy = { ...r };
          for (const [alias, col] of aliases) copy[alias] = r[col];
          return copy;
        });
        return { data, error: null };
      }),
    };
    return builder;
  });

  return { from };
}

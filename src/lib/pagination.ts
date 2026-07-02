// Pure page-window math shared by paginated admin API routes.

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Clamp a raw page value: NaN or < 1 becomes 1; otherwise floor to an integer. */
export function normalizePage(rawPage: number): number {
  if (!Number.isFinite(rawPage) || rawPage < 1) return 1;
  return Math.floor(rawPage);
}

/**
 * Slice a full array of items into a single page, clamping the page number
 * and computing the total page count. A page past the end returns an empty
 * `items` array with the correct `total`/`totalPages`.
 */
export function paginateArray<T>(items: T[], rawPage: number, pageSize: number): PagedResult<T> {
  const page = normalizePage(rawPage);
  const total = items.length;
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;
  const start = (page - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return { items: pageItems, page, pageSize, total, totalPages };
}

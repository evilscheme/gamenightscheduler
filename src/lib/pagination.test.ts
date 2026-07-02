import { describe, it, expect } from 'vitest';
import { normalizePage, paginateArray } from './pagination';

describe('normalizePage', () => {
  it('clamps page numbers below 1 to 1', () => {
    expect(normalizePage(0)).toBe(1);
    expect(normalizePage(-5)).toBe(1);
  });

  it('clamps NaN to 1', () => {
    expect(normalizePage(NaN)).toBe(1);
  });

  it('floors fractional page numbers', () => {
    expect(normalizePage(2.9)).toBe(2);
  });

  it('passes through valid integer pages unchanged', () => {
    expect(normalizePage(3)).toBe(3);
  });
});

describe('paginateArray', () => {
  it('returns an empty page with zero totalPages for an empty list', () => {
    const result = paginateArray<number>([], 1, 20);
    expect(result).toEqual({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });
  });

  it('returns exactly one full page when total is an exact multiple of pageSize', () => {
    const items = Array.from({ length: 40 }, (_, i) => i);
    const page1 = paginateArray(items, 1, 20);
    const page2 = paginateArray(items, 2, 20);

    expect(page1.items).toHaveLength(20);
    expect(page1.items[0]).toBe(0);
    expect(page1.totalPages).toBe(2);

    expect(page2.items).toHaveLength(20);
    expect(page2.items[0]).toBe(20);
    expect(page2.totalPages).toBe(2);
  });

  it('returns an empty items array with correct total/totalPages for an overflow page', () => {
    const items = Array.from({ length: 45 }, (_, i) => i);
    const result = paginateArray(items, 5, 20);

    expect(result.items).toEqual([]);
    expect(result.total).toBe(45);
    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(5);
  });

  it('clamps a page below 1 or NaN to page 1', () => {
    const items = Array.from({ length: 5 }, (_, i) => i);
    expect(paginateArray(items, 0, 20).page).toBe(1);
    expect(paginateArray(items, -3, 20).page).toBe(1);
    expect(paginateArray(items, NaN, 20).page).toBe(1);
  });
});

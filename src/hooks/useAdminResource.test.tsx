import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAdminResource } from './useAdminResource';

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: () => Promise.resolve(body) } as Response;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useAdminResource', () => {
  it('starts loading and populates data on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ total: 3 }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAdminResource<{ total: number }>('/api/admin/stats'));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual({ total: 3 });
    expect(result.current.error).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/stats');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sets an error message when the response is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, false));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAdminResource('/api/admin/broken'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Failed to fetch /api/admin/broken');
  });

  it('sets an error message when fetch rejects', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAdminResource('/api/admin/stats'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('network down');
  });

  it('does not fetch while disabled, and fetches once enabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderHook(
      ({ enabled }) => useAdminResource<{ ok: boolean }>('/api/admin/stats', enabled),
      { initialProps: { enabled: false } }
    );

    expect(result.current.loading).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({ ok: true });
  });

  it('refetches when the url changes (e.g. pagination)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ page: 1 }))
      .mockResolvedValueOnce(jsonResponse({ page: 2 }));
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderHook(
      ({ page }) => useAdminResource<{ page: number }>(`/api/admin/upcoming-sessions?page=${page}`),
      { initialProps: { page: 1 } }
    );

    await waitFor(() => expect(result.current.data).toEqual({ page: 1 }));

    rerender({ page: 2 });

    await waitFor(() => expect(result.current.data).toEqual({ page: 2 }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refetch() re-runs the fetch against the same url', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ count: 1 }))
      .mockResolvedValueOnce(jsonResponse({ count: 2 }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAdminResource<{ count: number }>('/api/admin/stats'));

    await waitFor(() => expect(result.current.data).toEqual({ count: 1 }));

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.data).toEqual({ count: 2 }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

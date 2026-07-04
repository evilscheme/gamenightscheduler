import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { serverError, logServerError } from './apiError';

describe('apiError', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { errSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { errSpy.mockRestore(); });

  it('serverError returns 500 with a stable body shape and a UUID errorId', async () => {
    const res = serverError(new Error('boom'), { route: '/api/x' });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
    expect(body.errorId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('logs one structured JSON line containing route, errorId, and message', () => {
    logServerError(new Error('kaboom'), { route: '/api/y', gameId: 'g1' });
    expect(errSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse((errSpy.mock.calls[0] as unknown[])[0] as string);
    expect(logged.level).toBe('error');
    expect(logged.route).toBe('/api/y');
    expect(logged.gameId).toBe('g1');
    expect(logged.message).toBe('kaboom');
    expect(logged.errorId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('serverError body errorId matches the logged errorId', () => {
    logServerError(new Error('x'), { route: '/api/z' });
    const logged = JSON.parse((errSpy.mock.calls[0] as unknown[])[0] as string);
    expect(logged.errorId).toBeTruthy();
  });
});

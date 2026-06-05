import { describe, it, expect } from 'vitest';
import { chooseHomeView } from './homeView';

describe('chooseHomeView', () => {
  it("returns 'app' for a valid session (claims present)", () => {
    expect(chooseHomeView({ data: { claims: { sub: 'user-1' } }, error: null })).toBe('app');
  });

  it("returns 'app' for an expired/invalid token (error present)", () => {
    expect(chooseHomeView({ data: null, error: { message: 'jwt expired' } })).toBe('app');
  });

  it("returns 'splash' when there is no session (data null, error null)", () => {
    expect(chooseHomeView({ data: null, error: null })).toBe('splash');
  });

  it("returns 'splash' when data is present but has no claims and no error", () => {
    expect(chooseHomeView({ data: {}, error: null })).toBe('splash');
  });

  it("returns 'splash' when data.claims is null and there is no error", () => {
    expect(chooseHomeView({ data: { claims: null }, error: null })).toBe('splash');
  });
});

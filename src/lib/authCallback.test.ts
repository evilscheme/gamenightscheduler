import { describe, it, expect } from 'vitest';
import {
  buildOAuthRedirectUrl,
  classifyAuthCallbackError,
  getAuthErrorMessage,
} from './authCallback';

describe('buildOAuthRedirectUrl', () => {
  it('tags the callback with the provider that started the flow', () => {
    expect(buildOAuthRedirectUrl('https://app.test', 'discord')).toBe(
      'https://app.test/auth/callback?provider=discord'
    );
  });

  it('carries the intended destination alongside the provider', () => {
    expect(buildOAuthRedirectUrl('https://app.test', 'google', '/games/join/ABC')).toBe(
      'https://app.test/auth/callback?provider=google&next=%2Fgames%2Fjoin%2FABC'
    );
  });
});

describe('classifyAuthCallbackError', () => {
  it('recognizes the provider-returned-no-email failure', () => {
    // Verbatim shape of a Supabase Auth error redirect for an OAuth account
    // with no email address (GoTrue redirectErrors -> query params).
    const params = new URLSearchParams({
      error: 'server_error',
      error_code: 'unexpected_failure',
      error_description: 'Error getting user email from external provider',
    });

    expect(classifyAuthCallbackError(params)).toBe('provider_no_email');
  });

  it('recognizes a declined consent screen', () => {
    const params = new URLSearchParams({
      error: 'access_denied',
      error_description: 'The user denied the request',
    });

    expect(classifyAuthCallbackError(params)).toBe('access_denied');
  });

  it('falls back to auth_failed for an unrecognized provider error', () => {
    const params = new URLSearchParams({
      error: 'server_error',
      error_description: 'Unable to exchange external code',
    });

    expect(classifyAuthCallbackError(params)).toBe('auth_failed');
  });

  it('returns null when the callback carries no error', () => {
    expect(classifyAuthCallbackError(new URLSearchParams({ code: 'abc123' }))).toBeNull();
  });
});

describe('getAuthErrorMessage', () => {
  it('names the provider that failed and how to fix it', () => {
    const message = getAuthErrorMessage('provider_no_email', 'discord');

    expect(message).toMatch(/discord/i);
    expect(message).toMatch(/no email address/i);
  });

  it('does not blame Discord when a different provider failed', () => {
    const message = getAuthErrorMessage('provider_no_email', 'google');

    expect(message).toMatch(/google/i);
    expect(message).not.toMatch(/discord/i);
  });

  it('stays provider-neutral when the callback did not say which provider failed', () => {
    const message = getAuthErrorMessage('provider_no_email', null);

    expect(message).toMatch(/no email address/i);
    expect(message).not.toMatch(/discord/i);
    expect(message).not.toMatch(/google/i);
  });

  it('ignores a provider value it does not recognize', () => {
    expect(getAuthErrorMessage('provider_no_email', 'evilcorp')).toBe(
      getAuthErrorMessage('provider_no_email', null)
    );
  });

  it('returns null when there is no error to show', () => {
    expect(getAuthErrorMessage(null)).toBeNull();
    expect(getAuthErrorMessage('')).toBeNull();
  });

  it('shows the generic message for a reason it does not know', () => {
    expect(getAuthErrorMessage('not_a_real_reason')).toBe(getAuthErrorMessage('auth_failed'));
  });
});

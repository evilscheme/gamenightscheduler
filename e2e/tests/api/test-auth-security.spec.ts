import { test, expect } from '@playwright/test';
import { TEST_AUTH_HEADERS } from '../../helpers/test-auth';

/**
 * Test-Auth API Security Tests
 *
 * Verifies that the /api/test-auth endpoint requires the correct secret header.
 * Without the secret, all methods should return 404 (to avoid revealing the route exists).
 */

test.describe('Test-Auth Secret Validation', () => {
  test('POST without secret header returns 404', async ({ request }) => {
    const response = await request.post('http://localhost:3001/api/test-auth', {
      data: { email: 'attacker@evil.com', name: 'Attacker' },
    });

    expect(response.status()).toBe(404);
  });

  test('POST with wrong secret header returns 404', async ({ request }) => {
    const response = await request.post('http://localhost:3001/api/test-auth', {
      data: { email: 'attacker@evil.com', name: 'Attacker' },
      headers: { 'x-test-auth-secret': 'wrong-secret' },
    });

    expect(response.status()).toBe(404);
  });

  test('DELETE without secret header returns 404', async ({ request }) => {
    const response = await request.delete(
      'http://localhost:3001/api/test-auth?email=test@example.com'
    );

    expect(response.status()).toBe(404);
  });

  test('PUT without secret header returns 404', async ({ request }) => {
    const response = await request.put('http://localhost:3001/api/test-auth');

    expect(response.status()).toBe(404);
  });

  test('POST with correct secret header succeeds', async ({ request }) => {
    const response = await request.post('http://localhost:3001/api/test-auth', {
      data: {
        email: `security-test-${Date.now()}@e2e.local`,
        name: 'Security Test User',
      },
      headers: TEST_AUTH_HEADERS,
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('email');
  });
});

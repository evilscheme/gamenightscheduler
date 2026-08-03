import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

// handle_new_user() runs inside the GoTrue signup transaction, so anything it
// lets through to a public.users constraint aborts the whole signup — the user
// simply cannot create an account. It must sanitize, never reject. These
// exercise the trigger directly because the failure is invisible from the app:
// the transaction rolls back and leaves no row to inspect.
function sql(statement: string): string {
  return execSync(`psql "${DB_URL}" -tA`, { encoding: 'utf8', input: statement }).trim();
}

const RUN = Date.now();

test.describe('handle_new_user() name fallbacks', () => {
  const created: string[] = [];

  test.afterAll(() => {
    for (const id of created) {
      sql(`DELETE FROM auth.users WHERE id = '${id}';`);
    }
  });

  /** Simulates a GoTrue signup and returns the name the trigger derived. */
  function signUp(metadata: string, email: string): string {
    const id = randomUUID();
    created.push(id);
    sql(
      `INSERT INTO auth.users
         (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
       VALUES
         ('${id}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          '${email}', '${metadata}'::jsonb, '{"provider":"discord"}'::jsonb, now(), now());`
    );
    return sql(`SELECT name FROM public.users WHERE id = '${id}';`);
  }

  test('uses the email local part when the provider sends an empty display name', () => {
    expect(signUp('{"full_name": ""}', `noname-${RUN}@e2e.local`)).toBe(`noname-${RUN}`);
  });

  test('falls back to a placeholder when neither metadata nor email yields a name', () => {
    expect(signUp('{}', `@e2e-${RUN}.local`)).toBe('Player');
  });

  test('still prefers the display name the provider supplied', () => {
    expect(signUp('{"full_name": "Ada Lovelace"}', `ada-${RUN}@e2e.local`)).toBe('Ada Lovelace');
  });
});

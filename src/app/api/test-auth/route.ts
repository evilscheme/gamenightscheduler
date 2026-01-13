import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Test-only authentication route for E2E testing.
 *
 * This route creates test users and establishes sessions without requiring OAuth.
 * It uses the admin client to create users and email/password auth for sessions.
 *
 * SECURITY: This route is ONLY available in non-production environments.
 * In production, it returns 404 to avoid exposing its existence.
 */

// CRITICAL: Block access in production
if (process.env.NODE_ENV === 'production') {
  console.warn('test-auth route loaded in production - all requests will return 404');
}

interface TestUserRequest {
  email: string;
  name: string;
  is_gm?: boolean;
}

interface TestUserResponse {
  id: string;
  email: string;
  name: string;
  is_gm: boolean;
}

export async function POST(request: Request): Promise<Response> {
  // SECURITY: Return 404 in production (not 403 to avoid revealing route exists)
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not found', { status: 404 });
  }

  try {
    const body = (await request.json()) as TestUserRequest;
    const { email, name, is_gm = false } = body;

    if (!email || !name) {
      return NextResponse.json(
        { error: 'email and name are required' },
        { status: 400 }
      );
    }

    // Use a consistent password for all test users
    const testPassword = 'test-password-123!';

    const admin = createAdminClient();

    // Check if user already exists
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find((u) => u.email === email);

    let userId: string;

    if (existingUser) {
      // User exists - update their password to ensure we can sign in
      userId = existingUser.id;
      await admin.auth.admin.updateUserById(userId, {
        password: testPassword,
      });
    } else {
      // Create new user with email/password auth
      const { data: newUser, error: createError } =
        await admin.auth.admin.createUser({
          email,
          password: testPassword,
          email_confirm: true, // Auto-confirm email for testing
          user_metadata: {
            full_name: name,
          },
        });

      if (createError || !newUser.user) {
        console.error('Failed to create test user:', createError);
        return NextResponse.json(
          { error: 'Failed to create user', details: createError?.message },
          { status: 500 }
        );
      }

      userId = newUser.user.id;
    }

    // Wait a moment for the database trigger to create the profile
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Update the user profile with is_gm if needed
    const { error: updateError } = await admin
      .from('users')
      .update({ name, is_gm })
      .eq('id', userId);

    if (updateError) {
      console.error('Failed to update user profile:', updateError);
      // Continue anyway - the profile might still work
    }

    // Now sign in using the server client to set proper cookies
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password: testPassword,
      });

    if (signInError || !signInData.user) {
      console.error('Failed to sign in test user:', signInError);
      return NextResponse.json(
        { error: 'Failed to sign in', details: signInError?.message },
        { status: 500 }
      );
    }

    // Fetch the profile to return
    const { data: profile } = await admin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    const responseData: TestUserResponse = {
      id: userId,
      email,
      name: profile?.name || name,
      is_gm: profile?.is_gm || is_gm,
    };

    // Create response with the session cookies
    const response = NextResponse.json(responseData);

    // Copy all cookies that were set during sign-in to the response
    // Note: httpOnly must be false for the Supabase browser client to read the session
    const allCookies = cookieStore.getAll();
    for (const cookie of allCookies) {
      response.cookies.set(cookie.name, cookie.value, {
        path: '/',
        httpOnly: false,  // Browser client needs to read this
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
    }

    return response;
  } catch (error) {
    console.error('Test auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also support DELETE to clean up test users
export async function DELETE(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not found', { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'email query parameter is required' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Find user by email
    const { data: users } = await admin.auth.admin.listUsers();
    const user = users?.users.find((u) => u.email === email);

    if (!user) {
      return NextResponse.json({ success: true, message: 'User not found' });
    }

    // Delete the user (cascades to profile via FK)
    const { error } = await admin.auth.admin.deleteUser(user.id);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete user', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Test auth delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Sign out the current user
export async function PUT(): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not found', { status: 404 });
  }

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    await supabase.auth.signOut();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Test auth signout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

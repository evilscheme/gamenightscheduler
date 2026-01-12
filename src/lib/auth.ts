import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import DiscordProvider from 'next-auth/providers/discord';
import { createServerClient } from './supabase';

const providers = [];

// Only add Google provider if credentials are configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

// Only add Discord provider if credentials are configured
if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
  providers.push(
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      try {
        const supabase = createServerClient();

        // Check if user exists, create if not
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .single();

        if (!existingUser) {
          const { error } = await supabase.from('users').insert({
            email: user.email,
            name: user.name || user.email.split('@')[0],
            avatar_url: user.image,
            is_gm: false,
          });

          if (error) {
            console.error('Error creating user:', error);
            return false;
          }
        }
      } catch (error) {
        console.error('Error in signIn callback:', error);
        return false;
      }

      return true;
    },
    async session({ session }) {
      if (session.user?.email) {
        try {
          const supabase = createServerClient();
          const { data: dbUser } = await supabase
            .from('users')
            .select('id, is_gm')
            .eq('email', session.user.email)
            .single();

          if (dbUser) {
            session.user.id = dbUser.id;
            session.user.isGm = dbUser.is_gm;
          }
        } catch (error) {
          console.error('Error in session callback:', error);
        }
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
      }
      return token;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
};

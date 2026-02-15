import { createBrowserClient } from '@supabase/ssr';

// --- Backend status callback registry ---

type StatusListener = (isError: boolean) => void;

const listeners = new Set<StatusListener>();

/**
 * Register a callback invoked when a Supabase request detects an outage
 * (network error or 5xx) or recovery (2xx). Returns an unsubscribe function.
 */
export function onSupabaseStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(isError: boolean) {
  listeners.forEach((fn) => fn(isError));
}

// --- Monitored fetch wrapper ---

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

function createMonitoredFetch(): typeof fetch {
  return async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    const isSupabaseRequest = url.startsWith(supabaseUrl);

    try {
      const response = await fetch(input, init);

      if (isSupabaseRequest) {
        if (response.status >= 500) {
          notifyListeners(true);
        } else if (response.ok) {
          notifyListeners(false);
        }
      }

      return response;
    } catch (error) {
      if (!isSupabaseRequest) throw error;

      // Retry once on network errors — Safari closes idle keep-alive
      // connections, so the first request after inactivity fails but
      // a retry on a fresh connection succeeds.
      try {
        const retryResponse = await fetch(input, init);

        if (retryResponse.status >= 500) {
          notifyListeners(true);
        } else if (retryResponse.ok) {
          notifyListeners(false);
        }

        return retryResponse;
      } catch (retryError) {
        notifyListeners(true);
        throw retryError;
      }
    }
  };
}

// --- Client factory ---

export function createClient() {
  return createBrowserClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: createMonitoredFetch(),
      },
    }
  );
}

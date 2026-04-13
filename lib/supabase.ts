import {
  createBrowserClient as createBrowserSupabaseClient,
  createServerClient as createServerSupabaseClient,
} from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client for Server Components and API Route Handlers.
 * Uses the anon key + cookie-based auth (respects RLS).
 */
export async function createServerComponentClient() {
  const cookieStore = await cookies();

  return createServerSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll can fail in Server Components where cookies are read-only.
            // This is expected — the middleware handles cookie refreshes.
          }
        },
      },
    }
  );
}

/**
 * Browser-side Supabase client for "use client" components.
 */
export function createBrowserComponentClient() {
  return createBrowserSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

let supabaseAdminClient: SupabaseClient | null = null;

function getSupabaseAdminClient(): SupabaseClient {
  if (supabaseAdminClient) return supabaseAdminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  supabaseAdminClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return supabaseAdminClient;
}

/**
 * Admin Supabase client using the service role key (lazy init so `next build`
 * does not require env at module load).
 */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseAdminClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});

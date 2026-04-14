import { createServerClient as createServerSupabaseClient } from "@supabase/ssr";
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
            // The middleware handles cookie refreshes.
          }
        },
      },
    }
  );
}

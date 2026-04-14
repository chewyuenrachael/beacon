import { createBrowserClient as createBrowserSupabaseClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client for "use client" components.
 */
export function createBrowserComponentClient() {
  return createBrowserSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Browser-side Supabase client (anon key). Used only for public reads on
// cards_catalog and card_prices — RLS policies enforce SELECT-only.
//
// Server-side scripts (seed/snapshot) use the service role key and bypass
// RLS; they create their own client directly.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export const useSupabase = (): SupabaseClient => {
  if (_client) return _client;
  const config = useRuntimeConfig();
  const url = config.public.supabaseUrl as string;
  const key = config.public.supabaseAnonKey as string;
  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing (NUXT_PUBLIC_SUPABASE_URL / NUXT_PUBLIC_SUPABASE_ANON_KEY)",
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
};

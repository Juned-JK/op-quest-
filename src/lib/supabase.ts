import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Supabase browser client.
 * `null` when env vars are not configured — all DB operations degrade gracefully.
 */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null;

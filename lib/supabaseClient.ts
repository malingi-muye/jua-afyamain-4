
// Lightweight wrapper for initializing a Supabase client for legacy imports.
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

const supabase = createSupabaseClient(supabaseUrl, supabaseKey)

export { createSupabaseClient as createClient, supabase }

// Re-export legacy client helpers for code that imports from `lib/supabaseClient`
export { getSupabase } from "./supabase/client"

if (!supabase) {
  throw new Error("Supabase client is not initialized")
}

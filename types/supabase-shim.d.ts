// Lightweight Supabase type shims to reduce `never`-type noise
// This makes the supabase client and its `from()` calls `any` until full DB types are added.

declare module '@supabase/supabase-js' {
  export function createClient(...args: any[]): any
  export type SupabaseClient = any
}

export {}

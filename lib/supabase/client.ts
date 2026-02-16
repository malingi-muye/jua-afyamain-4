import { getSupabaseClient } from "./singleton"

let _client: ReturnType<typeof getSupabaseClient> | null = null

export function createClient() {
  if (typeof window === "undefined") {
    throw new Error("createClient() can only be called on the client side")
  }

  if (!_client) {
    _client = getSupabaseClient()
  }

  return _client
}

export function getSupabase() {
  return createClient()
}

// Export for backward compatibility - wrapped in getter to avoid immediate initialization
export const supabase = {
  get auth() {
    return getSupabase().auth
  },
  get from() {
    return getSupabase().from.bind(getSupabase())
  },
  get rpc() {
    return getSupabase().rpc.bind(getSupabase())
  },
  get removeAllChannels() {
    return getSupabase().removeAllChannels.bind(getSupabase())
  },
} as any

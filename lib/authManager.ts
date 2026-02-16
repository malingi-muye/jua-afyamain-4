import { supabase } from "@/lib/supabaseClient"
import type { AuthChangeEvent, Session } from "@supabase/supabase-js"
import logger from "@/lib/logger"

type AuthCallback = (event: AuthChangeEvent, session: Session | null) => void

let isInitializing = false
let initialized = false
let subscription: any = null
const listeners = new Set<AuthCallback>()

export async function initAuthManager() {
  if (initialized || isInitializing) {
    logger.debug('[authManager] initAuthManager called but already initialized or in progress')
    return
  }
  isInitializing = true
  logger.log('[authManager] Initializing auth manager')

  // Subscribe to Supabase auth changes once for the app
  const { data } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
    logger.log('[authManager] Auth state changed:', event, { sessionExists: !!session, userId: session?.user?.id })
    // Broadcast to listeners
    for (const cb of [...listeners]) {
      try {
        cb(event, session)
      } catch (err) {
        logger.error('[authManager] Listener error:', err)
      }
    }
  })

  subscription = data?.subscription || data
  initialized = true
  isInitializing = false
}

export function subscribeAuth(cb: AuthCallback) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function isInitialized() {
  return initialized
}

export function getSubscription() {
  return subscription
}

export function teardownAuthManager() {
  if (subscription && typeof subscription.unsubscribe === 'function') {
    try {
      subscription.unsubscribe()
    } catch (err) {
      logger.warn('[authManager] Error unsubscribing:', err)
    }
  }
  listeners.clear()
  initialized = false
  subscription = null
  logger.log('[authManager] Teardown complete')
}

/**
 * Token Migration Helper
 * 
 * Handles migration from localStorage-based tokens (SafeStorage)
 * to HttpOnly cookie-based tokens (Supabase SSR)
 * 
 * This is a transitional helper to ensure smooth migration
 * without breaking existing sessions.
 */

import logger from '@/lib/logger'

/**
 * Check if user has old localStorage tokens
 */
export function hasLegacyTokens(): boolean {
  try {
    if (typeof window === 'undefined') return false

    const authToken = window.localStorage?.getItem('sb-auth-token')
    return !!authToken
  } catch (e) {
    return false
  }
}

/**
 * Check if user has new cookie-based tokens
 */
export function hasModernTokens(): boolean {
  try {
    if (typeof document === 'undefined') return false

    // Check for Supabase auth cookies
    const hasCookie = document.cookie.includes('sb-')
    return hasCookie
  } catch (e) {
    return false
  }
}

/**
 * Get legacy token if it exists
 */
export function getLegacyToken(): any {
  try {
    if (typeof window === 'undefined') return null

    const tokenStr = window.localStorage?.getItem('sb-auth-token')
    if (!tokenStr) return null

    return JSON.parse(tokenStr)
  } catch (e) {
    logger.warn('Failed to parse legacy token:', e)
    return null
  }
}

/**
 * Clear legacy tokens from localStorage
 */
export function clearLegacyTokens(): void {
  try {
    if (typeof window === 'undefined') return

    const keysToRemove = [
      'sb-auth-token',
      'sb-refresh-token',
      'supabase.auth.token',
      'supabase.auth.expires_at',
    ]

    keysToRemove.forEach(key => {
      try {
        window.localStorage?.removeItem(key)
      } catch (e) {
        logger.warn(`Failed to remove ${key}:`, e)
      }
    })

    logger.debug('Legacy tokens cleared from localStorage')
  } catch (e) {
    logger.warn('Failed to clear legacy tokens:', e)
  }
}

/**
 * Show migration banner to user
 * Encourages re-login for enhanced security
 */
export function showMigrationPrompt(): {
  show: boolean
  reason: 'legacy-tokens' | 'force-reauth' | 'none'
} {
  try {
    const hasLegacy = hasLegacyTokens()
    const hasModern = hasModernTokens()

    // Show if has legacy but not modern
    if (hasLegacy && !hasModern) {
      return {
        show: true,
        reason: 'legacy-tokens',
      }
    }

    // Show if has no tokens at all (shouldn't happen unless cleared)
    if (!hasLegacy && !hasModern) {
      return {
        show: false,
        reason: 'none',
      }
    }

    return {
      show: false,
      reason: 'none',
    }
  } catch (e) {
    logger.error('Migration prompt check failed:', e)
    return {
      show: false,
      reason: 'none',
    }
  }
}

/**
 * Log migration status for debugging
 */
export function logMigrationStatus(): void {
  const hasLegacy = hasLegacyTokens()
  const hasModern = hasModernTokens()

  logger.debug('[Auth Migration Status]', {
    hasLegacyTokens: hasLegacy,
    hasModernTokens: hasModern,
    needsMigration: hasLegacy && !hasModern,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Initiate secure re-login flow
 * Called when user needs to migrate to new auth system
 */
export function initiateSecureReauth(
  onReauthRequired: () => void
): void {
  try {
    logMigrationStatus()

    const { show, reason } = showMigrationPrompt()

    if (show && reason === 'legacy-tokens') {
      logger.log(
        '[Auth Migration] User has legacy tokens - requesting secure re-authentication'
      )

      // Clear old tokens to force fresh login
      clearLegacyTokens()

      // Trigger re-authentication
      onReauthRequired()
    }
  } catch (e) {
    logger.error('[Auth Migration] Error during re-auth initiation:', e)
  }
}

/**
 * Migration status for monitoring
 */
export interface MigrationStatus {
  legacyTokensPresent: boolean
  modernTokensPresent: boolean
  needsMigration: boolean
  lastChecked: Date
  userEmail?: string
}

/**
 * Get current migration status
 */
export function getMigrationStatus(userEmail?: string): MigrationStatus {
  return {
    legacyTokensPresent: hasLegacyTokens(),
    modernTokensPresent: hasModernTokens(),
    needsMigration: hasLegacyTokens() && !hasModernTokens(),
    lastChecked: new Date(),
    userEmail,
  }
}

/**
 * Report migration status to analytics/monitoring
 * Use this to track how many users are still on legacy auth
 */
export function reportMigrationStatus(userEmail?: string): void {
  const status = getMigrationStatus(userEmail)

  if (status.needsMigration) {
    // This can be sent to Sentry, datadog, etc.
    logger.warn('[Auth Migration] User still on legacy tokens', {
      email: userEmail,
      status,
    })
  }
}

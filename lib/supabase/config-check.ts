/**
 * Supabase Configuration Status Check
 * Use this to verify that Supabase credentials are properly configured
 */

import logger from "../logger"

export function getSupabaseConfigStatus() {
  const url =
    import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""

  const key =
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""

  const isConfigured = !!(url && key)

  return {
    isConfigured,
    hasUrl: !!url,
    hasKey: !!key,
    url: url ? `${url.substring(0, 20)}...` : null,
    message: isConfigured
      ? "✅ Supabase is configured - authentication will work"
      : "⚠️ Supabase is NOT configured - app will run in demo mode",
  }
}

export function logSupabaseStatus() {
  const status = getSupabaseConfigStatus()
  
  // Use logger for informational/warning output so it can be toggled via VERBOSE flag

  if (status.isConfigured) {
    logger.log(
      "%c✅ Supabase Configuration Status: READY",
      "color: green; font-weight: bold; font-size: 14px"
    )
    logger.log(`   URL: ${status.url}`)
  } else {
    logger.warn(
      "%c⚠️ Supabase Configuration Status: NOT CONFIGURED",
      "color: orange; font-weight: bold; font-size: 14px"
    )
    logger.warn("   URL:", status.hasUrl ? "SET" : "MISSING")
    logger.warn("   Key:", status.hasKey ? "SET" : "MISSING")
    logger.warn(
      "\n   To enable authentication, set these environment variables:"
    )
    logger.warn("   - VITE_SUPABASE_URL")
    logger.warn("   - VITE_SUPABASE_ANON_KEY")
    logger.warn(
      "\n   Get these values from your Supabase project settings:"
    )
    logger.warn("   1. Go to https://app.supabase.com")
    logger.warn("   2. Select your project")
    logger.warn("   3. Go to Settings > API")
    logger.warn("   4. Copy Project URL and anon key")
  }
}

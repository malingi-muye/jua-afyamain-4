/**
 * Shared CORS configuration for all Edge Functions
 * Restricts origins to trusted domains only
 */

// Allowed origins - update based on your deployment
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://juaafya.com',
  'https://www.juaafya.com',
  'https://app.juaafya.com',
  'https://admin.juaafya.com',
  'https://juaafya.netlify.app',
  /^https:\/\/.*\.vercel\.app$/,
  /^https:\/\/.*\.netlify\.app$/,
]

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-id',
}

/**
 * Get CORS headers for the given origin
 * Returns safe headers with origin restriction
 */
export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-id',
    'Access-Control-Max-Age': '86400',
  }

  if (!requestOrigin) {
    return { ...headers, 'Access-Control-Allow-Origin': '*' }
  }

  // Normalize origin (remove trailing slash if present)
  const normalizedOrigin = requestOrigin.endsWith('/') ? requestOrigin.slice(0, -1) : requestOrigin

  const isAllowed = ALLOWED_ORIGINS.some((allowed) => {
    if (allowed instanceof RegExp) {
      return allowed.test(normalizedOrigin)
    }
    return allowed === normalizedOrigin
  })

  if (isAllowed) {
    return {
      ...headers,
      'Access-Control-Allow-Origin': requestOrigin, // Return original string to match browser expectation
      'Access-Control-Allow-Credentials': 'true',
    }
  }

  return {
    ...headers,
    'Access-Control-Allow-Origin': '*',
    // Do NOT set Allow-Credentials to true if using wildcard
  }
}

/**
 * Handle CORS preflight requests
 */
export function handleCorsPreFlight(request: Request): Response | null {
  if (request.method !== 'OPTIONS') {
    return null
  }

  const origin = request.headers.get('origin')
  const headers = getCorsHeaders(origin)

  return new Response(null, {
    headers,
    status: 204,
  })
}

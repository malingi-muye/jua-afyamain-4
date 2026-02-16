// @ts-ignore: Deno std lib import for edge function runtime; types are not available in TS build
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts'

// Twilio webhook stub
// Validates presence of TWILIO_AUTH_TOKEN and responds to incoming webhook POSTs.
// In production you should validate X-Twilio-Signature header for authenticity.

serve(async (req: any) => {
  // Handle CORS preflight
  const corsPreFlight = handleCorsPreFlight(req)
  if (corsPreFlight) {
    return corsPreFlight
  }

  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)
  try {
    const env = globalThis as any
    const TW_AUTH = env?.TWILIO_AUTH_TOKEN
    const SUPABASE_URL = env?.SUPABASE_URL
    const SERVICE_KEY = env?.SUPABASE_SERVICE_ROLE_KEY
    if (!TW_AUTH) {
      return new Response(JSON.stringify({ error: 'TWILIO_AUTH_TOKEN not configured' }), { status: 500 })
    }
    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.warn('Supabase not configured; webhook will only validate signature')
    }

    const sigHeader = req.headers.get('x-twilio-signature') || ''
    const url = req.url
    const contentType = req.headers.get('content-type') || ''

    const bodyText = await req.text()

    // Parse body params (Twilio sends application/x-www-form-urlencoded)
    const params = new URLSearchParams(bodyText)

    // Build the expected signature base string: URL + sorted params concatenated
    let base = url
    // Twilio requires parameters sorted by key
    const keys = Array.from(params.keys()).sort()
    for (const k of keys) {
      base += k + params.get(k)
    }

    // Compute HMAC-SHA1 and base64 encode
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey('raw', enc.encode(TW_AUTH), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(base))
    const sigBytes = new Uint8Array(sig as ArrayBuffer)
    let binary = ''
    for (let i = 0; i < sigBytes.length; i++) binary += String.fromCharCode(sigBytes[i])
    const expected = btoa(binary)

    if (sigHeader !== expected) {
      console.warn('Twilio signature mismatch', { received: sigHeader, expected })
      return new Response(JSON.stringify({ error: 'Invalid Twilio signature' }), { status: 403 })
    }

    // Signature valid — extract core fields and forward to whatsapp-action
    const from = params.get('From') || params.get('from') || ''
    const to = params.get('To') || params.get('to') || ''
    const body = params.get('Body') || params.get('body') || ''
    const messageSid = params.get('MessageSid') || params.get('MessageSid') || ''

    // If Supabase configured, check for idempotency (messageSid) then forward to whatsapp-action using service role key
    if (SUPABASE_URL && SERVICE_KEY) {
      try {
        // Idempotency: avoid re-processing the same Twilio message (webhooks may retry)
        if (messageSid) {
          const checkUrl = `${SUPABASE_URL}/rest/v1/inbound_messages?select=id&message_sid=eq.${encodeURIComponent(
            messageSid,
          )}`
          const checkResp = await fetch(checkUrl, {
            method: 'GET',
            headers: {
              apikey: SERVICE_KEY,
              Authorization: `Bearer ${SERVICE_KEY}`,
              Accept: 'application/json',
            },
          })

          if (checkResp.ok) {
            const existing = await checkResp.json()
            if (Array.isArray(existing) && existing.length > 0) {
              console.log('Duplicate inbound message, skipping processing for', messageSid)
              return new Response('', { status: 200 })
            }
          }
        }

        const funcUrl = `${SUPABASE_URL}/functions/v1/whatsapp-action`
        const resp = await fetch(funcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({ action: { type: 'INBOUND_MESSAGE', payload: { from, to, body, messageSid } } }),
        })

        if (!resp.ok) {
          console.error('Failed to forward inbound message to whatsapp-action', await resp.text())
        }
      } catch (err) {
        console.error('Error forwarding inbound message to whatsapp-action', err)
      }
    }

    return new Response('', { status: 200 })
  } catch (err) {
    console.error('twilio-webhook error', err)
    return new Response(JSON.stringify({ error: (err as any)?.message || String(err) }), { status: 500 })
  }
})

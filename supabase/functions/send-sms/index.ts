// Supabase Edge Function (Deno) - send-sms
// Implements Twilio SMS sending using server-side credentials.
// Required env vars in deployment: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts'

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsPreFlight = handleCorsPreFlight(req)
  if (corsPreFlight) {
    return corsPreFlight
  }

  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  try {
    // @ts-ignore
    const SID = Deno.env.get('TWILIO_ACCOUNT_SID')
    // @ts-ignore
    const AUTH = Deno.env.get('TWILIO_AUTH_TOKEN')
    // @ts-ignore
    const FROM = Deno.env.get('TWILIO_PHONE_NUMBER')

    if (!SID || !AUTH || !FROM) {
      console.error("Twilio credentials missing in environment variables")
      return new Response(JSON.stringify({ error: "SMS service credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const payload = await req.json()
    const recipient = payload.recipient || payload.to || payload.phone
    const message = payload.message || payload.body
    // Allow dynamic Sender ID (e.g., specific Clinic Name) if provided and allowed by Platform
    const senderId = payload.sender_id || payload.senderId || FROM

    if (!recipient || !message) {
      return new Response(JSON.stringify({ error: "Recipient and message are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`
    const params = new URLSearchParams()
    params.append("To", recipient)
    params.append("From", senderId)
    params.append("Body", message)

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${SID}:${AUTH}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    })

    const data = await resp.json()

    if (!resp.ok) {
      console.error("Twilio API Error:", data)
      return new Response(JSON.stringify({ error: "Failed to send SMS", details: data.message }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Don't leak full Twilio response if possible, just success status
    return new Response(JSON.stringify({ success: true, sid: data.sid }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (err: any) {
    console.error("send-sms execution error:", err)
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

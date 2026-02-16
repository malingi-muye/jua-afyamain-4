// Supabase Edge Function - send-email
// Sends emails via Gmail SMTP
// Required env vars:
// - GMAIL_SMTP_USER: Gmail email address
// - GMAIL_SMTP_PASSWORD: Gmail app-specific password (not regular password)
// - GMAIL_SMTP_HOST: Optional, defaults to smtp.gmail.com
// - GMAIL_SMTP_PORT: Optional, defaults to 587

// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// SMTPClient from deno smtp library
// @ts-ignore
import { SmtpClient } from "https://deno.land/x/smtp@0.16.0/mod.ts"
// @ts-ignore
import { authenticateRequest } from '../_shared/auth.ts'
// @ts-ignore
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts'

interface EmailRequest {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
}

serve(async (req: any) => {
  // Handle CORS preflight
  const corsPreFlight = handleCorsPreFlight(req)
  if (corsPreFlight) return corsPreFlight

  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  try {
    // 1. AUTHENTICATION CHECK
    const { user, error: authError, status: authStatus } = await authenticateRequest(req)
    if (authError) {
      return new Response(JSON.stringify({ error: "Unauthorized", message: authError }), { status: authStatus, headers: corsHeaders })
    }

    // Optional: Log who is sending the email
    console.log(`[send-email] User ${user.email} (${user.id}) is sending an email`)

    // 2. PROCEED TO SMTP LOGIC
    // @ts-ignore
    const env = (globalThis as any).Deno?.env?.toObject() || {}
    const SMTP_USER = env?.SMTP_USER || env?.GMAIL_SMTP_USER
    const SMTP_PASSWORD = env?.SMTP_PASSWORD || env?.GMAIL_SMTP_PASSWORD
    const SMTP_HOST = env?.SMTP_HOST || env?.GMAIL_SMTP_HOST || "smtp.gmail.com"
    const SMTP_PORT = Number(env?.SMTP_PORT || env?.GMAIL_SMTP_PORT || 587)
    const SMTP_FROM = env?.SMTP_FROM || SMTP_USER

    if (!SMTP_USER || !SMTP_PASSWORD) {
      console.error("SMTP credentials not configured")
      return new Response(
        JSON.stringify({
          error: "Email service not configured",
          message: "SMTP_USER and SMTP_PASSWORD environment variables are required",
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    const body: EmailRequest = await req.json()
    const { to, cc, bcc, subject, html, text, from } = body

    // Validate required fields
    if (!to || !subject || (!html && !text)) {
      return new Response(
        JSON.stringify({
          error: "Invalid request",
          message: "to, subject, and html/text are required",
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Normalize email arrays
    const recipients = Array.isArray(to) ? to : [to]
    const ccList = cc ? (Array.isArray(cc) ? cc : [cc]) : []
    const bccList = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : []

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const allEmails = [...recipients, ...ccList, ...bccList]
    for (const email of allEmails) {
      if (!emailRegex.test(email)) {
        return new Response(
          JSON.stringify({ error: "Invalid email format", email }),
          { status: 400, headers: corsHeaders }
        )
      }
    }

    // Create SMTP client
    const client = new SmtpClient()

    try {
      // Connect to Gmail SMTP server
      await client.connectTLS({
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        username: SMTP_USER,
        password: SMTP_PASSWORD,
      })

      await client.send({
        from: from || SMTP_FROM,
        to: recipients,
        cc: ccList.length > 0 ? ccList : undefined,
        bcc: bccList.length > 0 ? bccList : undefined,
        subject: subject,
        content: text || "",
        html: html,
      })

      // Close connection
      await client.close()

      console.log(`Email sent successfully to ${recipients.join(", ")}`)

      return new Response(
        JSON.stringify({
          success: true,
          message: "Email sent successfully",
          recipients: recipients.length,
        }),
        { status: 200, headers: corsHeaders }
      )
    } catch (smtpError) {
      console.error("SMTP error:", smtpError)

      // If SMTP fails, try to provide helpful error message
      let errorMessage = "Failed to send email via SMTP"

      if (smtpError instanceof Error) {
        if (smtpError.message.includes("authentication failed")) {
          errorMessage = "SMTP authentication failed. Check credentials."
        } else if (smtpError.message.includes("connection refused")) {
          errorMessage = "SMTP server connection failed"
        } else {
          errorMessage = smtpError.message
        }
      }

      console.error("SMTP Error Message:", errorMessage)

      return new Response(
        JSON.stringify({
          error: "SMTP error",
          message: errorMessage,
        }),
        { status: 500, headers: corsHeaders }
      )
    }
  } catch (err) {
    console.error("send-email error:", err)

    const errorMessage = err instanceof Error ? err.message : String(err)

    return new Response(
      JSON.stringify({
        error: "Server error",
        message: errorMessage,
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})

// @ts-ignore: Deno edge function
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

// Supabase Edge Function: mobiwave-proxy
// This function proxies Mobiwave API calls to keep the API token secure

const MOBIWAVE_API_BASE = 'https://sms.mobiwave.co.ke/api/v3'

// @ts-ignore: Deno serve
import { authenticateRequest } from '../_shared/auth.ts'
// @ts-ignore
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts'

// @ts-ignore: Deno serve
Deno.serve(async (req: Request) => {
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

        // Get API token from environment
        // @ts-ignore: Deno.env is available in edge function runtime
        const apiToken = (globalThis as any).Deno?.env.get('VITE_MOBIWAVE_API_TOKEN')
        if (!apiToken) {
            return new Response(
                JSON.stringify({ status: 'error', message: 'Mobiwave API token not configured' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            )
        }

        // Parse request
        const { action, ...payload } = await req.json()

        // Build headers
        const headers = {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }

        let response: Response

        // Route to appropriate Mobiwave endpoint
        switch (action) {
            case 'sendSMS':
                response = await fetch(`${MOBIWAVE_API_BASE}/sms/send`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload),
                })
                break

            case 'sendCampaign':
                response = await fetch(`${MOBIWAVE_API_BASE}/sms/campaign`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload),
                })
                break

            case 'getContactsInGroup':
                response = await fetch(`${MOBIWAVE_API_BASE}/contacts/${payload.groupId}/all`, {
                    method: 'POST',
                    headers,
                })
                break

            case 'storeContact':
                response = await fetch(`${MOBIWAVE_API_BASE}/contacts/${payload.groupId}/store`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        phone: payload.phone,
                        first_name: payload.first_name,
                        last_name: payload.last_name,
                    }),
                })
                break

            case 'updateContact':
                response = await fetch(`${MOBIWAVE_API_BASE}/contacts/${payload.groupId}/update/${payload.contactUid}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({
                        phone: payload.phone,
                        first_name: payload.first_name,
                        last_name: payload.last_name,
                    }),
                })
                break

            case 'deleteContact':
                response = await fetch(`${MOBIWAVE_API_BASE}/contacts/${payload.groupId}/delete/${payload.contactUid}`, {
                    method: 'DELETE',
                    headers,
                })
                break

            case 'getGroups':
                response = await fetch(`${MOBIWAVE_API_BASE}/contacts`, {
                    method: 'GET',
                    headers,
                })
                break

            case 'storeGroup':
                response = await fetch(`${MOBIWAVE_API_BASE}/contacts`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ name: payload.name }),
                })
                break

            case 'deleteGroup':
                response = await fetch(`${MOBIWAVE_API_BASE}/contacts/${payload.groupId}`, {
                    method: 'DELETE',
                    headers,
                })
                break

            default:
                return new Response(
                    JSON.stringify({ status: 'error', message: `Unknown action: ${action}` }),
                    { status: 400, headers: { 'Content-Type': 'application/json' } }
                )
        }

        const data = await response.json()
        return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (error: any) {
        return new Response(
            JSON.stringify({ status: 'error', message: error?.message || 'Unknown error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
})

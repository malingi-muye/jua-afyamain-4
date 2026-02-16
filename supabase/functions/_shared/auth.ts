// Shared authentication helper for Supabase Edge Functions
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

export const authenticateRequest = async (req: Request) => {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
        return { user: null, error: "Missing Authorization header", status: 401 }
    }

    try {
        const supabaseUrl = (globalThis as any).Deno?.env.get('SUPABASE_URL') || ''
        const supabaseAnonKey = (globalThis as any).Deno?.env.get('SUPABASE_ANON_KEY') || ''
        const supabase = createClient(supabaseUrl, supabaseAnonKey)

        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error } = await supabase.auth.getUser(token)

        if (error || !user) {
            return { user: null, error: "Invalid or expired token", status: 401 }
        }

        // 2. RATE LIMITING (L7 DDoS Protection)
        // Limits each user to 20 requests per minute across sensitive functions
        const { data: limitOk, error: limitError } = await supabase.rpc('check_rate_limit', {
            p_key: `user_api_${user.id}`,
            p_max_tokens: 20,
            p_refill_rate: 0.33 // ~20 tokens per minute
        })

        if (limitError) {
            console.error('Rate limit system error:', limitError)
            // We still allow the request if the rate limiter itself fails (fail-open for reliability)
        } else if (limitOk === false) {
            return { user: null, error: "Rate limit exceeded. Too many requests.", status: 429 }
        }

        return { user, error: null, status: 200 }
    } catch (err: any) {
        return { user: null, error: err.message || "Authentication failed", status: 500 }
    }
}

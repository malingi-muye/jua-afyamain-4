// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// @ts-ignore
import { authenticateRequest } from '../_shared/auth.ts'
// @ts-ignore
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts'

// @ts-ignore
serve(async (req: Request) => {
    // Handle CORS preflight
    const corsPreFlight = handleCorsPreFlight(req)
    if (corsPreFlight) return corsPreFlight

    const origin = req.headers.get('origin')
    const corsHeaders = getCorsHeaders(origin)

    try {
        // 1. AUTHENTICATION & RATE LIMITING
        const { user, error: authError, status: authStatus } = await authenticateRequest(req)
        if (authError) {
            return new Response(JSON.stringify({ status: false, message: authError }), { status: authStatus, headers: corsHeaders })
        }

        // @ts-ignore
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        // @ts-ignore
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        // @ts-ignore
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.7')
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { action, amount, email, phone, metadata, provider, reference, config } = await req.json()

        // Fetch clinic settings including payment config
        const { data: userData, error: userDbError } = await supabase
            .from('users')
            .select('clinic_id')
            .eq('id', user.id)
            .single();

        if (userDbError || !userData?.clinic_id) {
            throw new Error('Clinic context not found');
        }

        const { data: clinicData, error: clinicError } = await supabase
            .from('clinics')
            .select('settings')
            .eq('id', userData.clinic_id)
            .single();

        if (clinicError || !clinicData) {
            throw new Error('Failed to fetch clinic settings');
        }

        const dbConfig = clinicData.settings?.paymentConfig;
        let paystackSecret = dbConfig?.secretKey;

        // Security: Fallback to environment variable for platform-level payments if clinic config is missing
        const isSaaSPayment = metadata?.type === 'Plan' || metadata?.type === 'Credits';
        if (!paystackSecret && isSaaSPayment) {
            // @ts-ignore
            paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');
        }

        if (!paystackSecret && provider !== 'None') {
            throw new Error('Payment gateway not configured correctly');
        }

        // --- ACTIONS ---

        // 1. Initialize Payment
        if (action === 'initialize') {
            if (!amount || amount <= 0) throw new Error('Invalid amount');

            const response = await fetch('https://api.paystack.co/transaction/initialize', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${paystackSecret}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    amount: Math.round(amount * 100), // Kobo
                    metadata,
                    callback_url: dbConfig?.webhookUrl || config?.callbackUrl
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Initialization failed');

            return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // 2. M-Pesa Charge (STK Push)
        if (action === 'charge' || (provider === 'M-Pesa' && !action)) {
            const response = await fetch('https://api.paystack.co/charge', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${paystackSecret}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email || 'customer@juaafya.com',
                    amount: Math.round(amount * 100),
                    currency: "KES",
                    mobile_money: { phone, provider: "mpesa" },
                    metadata
                })
            });

            const apiData = await response.json();
            if (!response.ok) throw new Error(apiData.message || 'M-Pesa charge failed');

            const data = {
                status: true,
                data: {
                    reference: apiData.data?.reference,
                    message: apiData.data?.display_text || apiData.message || "Please check your phone"
                }
            };

            return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // 3. Verify Payment
        if (action === 'verify') {
            if (!reference) throw new Error('Reference missing');

            const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
                headers: { Authorization: `Bearer ${paystackSecret}` }
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Verification failed');

            return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // 4. Process Refund
        if (action === 'refund') {
            if (!reference) throw new Error('Reference missing');

            const response = await fetch('https://api.paystack.co/refund', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${paystackSecret}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    transaction: reference,
                    amount: amount ? Math.round(amount * 100) : undefined,
                    memo: metadata?.reason || 'Clinic Refund'
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Refund failed');

            return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        throw new Error(`Unsupported action or provider: ${action} / ${provider}`);

    } catch (error: any) {
        console.error('Edge Function Error:', error.message);
        return new Response(
            JSON.stringify({ status: false, message: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
    }
})

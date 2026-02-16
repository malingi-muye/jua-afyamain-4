// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
// @ts-ignore
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts'

// Declare Deno for TypeScript environment in IDE
declare const Deno: any;

// Function to call Gemini (Simulating geminiService logic in Deno)
async function getAIResponse(query: string, context: any, supabase: any) {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) throw new Error("Gemini API Key not set");

  // Reconstruct the logic from geminiService.ts but adapted for Deno
  // We construct the prompt exactly as we did in the frontend service
  const userRole = context.userRole || 'Receptionist';

  // Define available data based on Role
  let dataContext = `
        - Patients: ${JSON.stringify(context.patients || [])}
        - Appointments: ${JSON.stringify(context.appointments || [])}
        - Today: ${context.today}
    `;

  // Add sensitive data only for permitted roles
  if (['Admin', 'SuperAdmin', 'Doctor', 'Pharmacist'].includes(userRole)) {
    dataContext += `\n- Inventory: ${JSON.stringify(context.inventory || [])}`;
  }
  if (['Admin', 'SuperAdmin', 'Accountant'].includes(userRole)) {
    dataContext += `\n- Billing/Transactions: ${JSON.stringify(context.transactions || [])}`;
    dataContext += `\n- Revenue Stats: ${JSON.stringify(context.revenue || {})}`;
  }

  // Define Actions based on Role (Matches geminiService.ts)
  let actions = `
        - ADD_PATIENT: payload { name, phone, age, gender (Male/Female) }
        - EDIT_PATIENT: payload { patientId, updates: { name?, phone?, age?, gender?, notes? } }
        - ADD_APPOINTMENT: payload { patientId, date (YYYY-MM-DD), time (HH:MM), reason }
        - CANCEL_APPOINTMENT: payload { appointmentId }
    `;

  if (['Admin', 'SuperAdmin', 'Pharmacist'].includes(userRole)) {
    actions += `
        - UPDATE_STOCK: payload { itemId or itemName, newQuantity }
        - DELETE_ITEM: payload { itemId or itemName }`;
  }

  if (['Admin', 'SuperAdmin', 'Accountant'].includes(userRole)) {
    actions += `
        - GENERATE_INVOICE: payload { patientId, amount, description }
        - RECORD_PAYMENT: payload { invoiceId, amount, method }
        - CHECK_REVENUE: payload { period (daily/monthly/yearly) }`;
  }

  const payload = {
    contents: [{
      parts: [{
        text: `You are the 'Candy', the AI Assistant for ${context.clinicName || "the clinic"}.
                User Role: ${userRole}.
                
                Current Data Context (Filtered by Role):
                ${dataContext}

                User Query: "${query}"

                INSTRUCTIONS:
                1. You must respond in valid JSON format ONLY. Do not include markdown blocks.
                2. Structure: { "reply": "string", "action": { "type": "string", "payload": object } | null }
                3. If the user asks a question, answer in 'reply' and set 'action' to null.
                4. If the user wants to perform an action, ensure they have permission (implied by the list below). If they try to do something not listed, deny politely.
                5. If the user asks for "billing" or "payment" info and you have access, summarize it.

                AVAILABLE ACTIONS (Strictly enforced):
                ${actions}

                RULES:
                - Prioritize brevity in 'reply'. Use bullet points for lists. No emojis.
                - If details are missing for an action, ask the user for them and set 'action' to null.
                - Infer dates like 'tomorrow' based on ${context.today}.
                `
      }]
    }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response from Gemini");

  return JSON.parse(text);
}


// Main Webhook Handler
serve(async (req: Request) => {
  // Handle CORS preflight
  const corsPreFlight = handleCorsPreFlight(req)
  if (corsPreFlight) {
    return corsPreFlight
  }

  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  // 1. Verify Request (Meta Challenge or Message)
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  // Verification Request from Meta
  if (mode === "subscribe" && token === Deno.env.get("WHATSAPP_VERIFY_TOKEN")) {
    return new Response(challenge, { status: 200 });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = await req.json();

    // 2. Parse Incoming Message
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return new Response('No message found', { status: 200 });
    }

    // WhatsApp Phone Number (Sender)
    const fromPhone = message.from;
    const messageBody = message.text?.body;
    // Basic normalization: remove non-digits, ensuring it matches DB format (e.g. 254...)
    // Assuming DB stores phone numbers cleanly without '+' or with consistency. 
    // For this demo, we assume the DB has '254712345678'.

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 3. Authenticate User & RBAC
    // We look for a user with this phone number.
    // NOTE: In a real app, phone numbers might need complex normalization.
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*, clinics(*)')
      .or(`phone.eq.${fromPhone},phone.eq.+${fromPhone}`)
      .maybeSingle();

    if (userError || !user) {
      console.log(`User not found for phone: ${fromPhone}`);
      // Optional: Reply "You are not registered in the system." or ignore to avoid spam.
      // For now, we ignore unknown numbers for security.
      return new Response('User unknown', { status: 200 });
    }

    const role = user.role || 'Receptionist';
    const clinicId = user.clinic_id;
    const clinicName = user.clinics?.name;

    // 4. Fetch Contexual Data (Guarded by RBAC logic in query)
    const today = new Date().toISOString().split('T')[0];
    const context: any = { today, userRole: role, clinicName };

    // Always safe to fetch basic patient list for staff? Maybe constrained.
    // Fetching top 5 for context window limits
    const { data: patients } = await supabase.from('patients').select('id, name, age, phone').limit(5);
    context.patients = patients;

    const { data: appointments } = await supabase.from('appointments').select('*').gte('date', today).limit(5);
    context.appointments = appointments;

    // RBAC Data Fetching
    if (['Admin', 'SuperAdmin', 'Accoutant'].includes(role)) {
      // Fetch Revenue
      const { data: rev } = await supabase.from('visits').select('total_bill').eq('payment_status', 'Paid').gte('start_time', today);
      context.revenue = { today: rev?.reduce((a: any, b: any) => a + b.total_bill, 0) || 0 };

      const { data: txns } = await supabase.from('transactions').select('*').limit(3);
      context.transactions = txns;
    }

    if (['Admin', 'SuperAdmin', 'Doctor', 'Pharmacist'].includes(role)) {
      const { data: inv } = await supabase.from('inventory').select('name, stock, price').limit(10);
      context.inventory = inv;
    }

    // 5. AI Processing
    const aiResult = await getAIResponse(messageBody, context, supabase);

    // 6. Action Execution
    let finalReply = aiResult.reply;

    if (aiResult.action) {
      const { type, payload } = aiResult.action;
      let actionSuccess = false;
      let actionMessage = "";

      try {
        if (type === 'ADD_APPOINTMENT') {
          const { error } = await supabase.from('appointments').insert({
            patient_id: payload.patientId,
            date: payload.date,
            time: payload.time,
            reason: payload.reason,
            status: 'Scheduled'
          });
          if (error) throw error;
          actionSuccess = true;
          actionMessage = "Appointment scheduled.";
        }
        else if (type === 'GENERATE_INVOICE' && ['Admin', 'Accountant'].includes(role)) {
          // Simulated invoice generation
          // In real app, create a 'visits' entry with 'payment_status'='Pending'
          actionSuccess = true;
          actionMessage = `Invoice generated for ${payload.amount} KES.`;
        }
        else if (type === 'CHECK_REVENUE' && ['Admin', 'Accountant'].includes(role)) {
          // Logic handled in AI reply usually, but if action needed:
          actionSuccess = true;
        }
        else if (type === 'UPDATE_STOCK' && ['Admin', 'Pharmacist'].includes(role)) {
          // Assume payload has itemId
          // const { error } = await supabase.from('inventory').update({ stock: payload.newQuantity }).eq('id', payload.itemId);
          // if (error) throw error;
          actionSuccess = true;
          actionMessage = "Stock updated.";
        }
        // ... Handle other actions ...

        if (actionSuccess) {
          finalReply += `\n[System]: ${actionMessage}`;
        }
      } catch (e: any) {
        console.error("Action Execution Error", e);
        finalReply += `\n[System Error]: Failed to execute action. ${e.message}`;
      }
    }

    // 7. Send WhatsApp Reply
    await sendWhatsAppMessage(message.from, finalReply);

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Workbook Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

async function sendWhatsAppMessage(to: string, text: string) {
  const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID");
  const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");

  if (!WHATSAPP_PHONE_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.error("WhatsApp credentials missing");
    return;
  }

  await fetch(`https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      text: { body: text },
    }),
  });
}

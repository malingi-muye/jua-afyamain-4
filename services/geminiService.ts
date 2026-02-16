import { supabase } from "../lib/supabaseClient"
import logger from "../lib/logger"
import { categorizeGeminiError, shouldRetry, getRetryDelay, getGeminiErrorMessage, logGeminiError } from "../lib/gemini/error-handler"
import { isGeminiAvailable } from "../lib/gemini/config-check"

// Configuration
const MAX_RETRIES = 3

// Helper to call Edge Function with retry logic
const callGemini = async (payload: any, attemptNumber: number = 1): Promise<string> => {
  // Ensure supabase client and functions are available
  if (!supabase || !supabase.functions) {
    const error = "Supabase client not initialized. Please check your configuration."
    logger.error("[Gemini] " + error)
    throw new Error(error)
  }

  logger.log(`[Gemini] Invoking edge function (attempt ${attemptNumber}/${MAX_RETRIES})`, {
    model: payload.model,
    hasPrompt: !!payload.prompt,
    hasHistory: !!payload.history && payload.history.length > 0,
  })

  try {
    const { data, error } = await supabase.functions.invoke("gemini-chat", {
      body: payload,
    })

    // Handle edge function invocation error
    if (error) {
      logger.warn(`[Gemini] Edge function error (attempt ${attemptNumber}):`, error)

      // Check if we should retry
      if (shouldRetry(error, attemptNumber, MAX_RETRIES)) {
        const delay = getRetryDelay(attemptNumber)
        logger.log(`[Gemini] Retrying in ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return callGemini(payload, attemptNumber + 1)
      }

      logGeminiError(error, "invoke")
      throw error
    }

    // Handle API response error
    if (data?.error) {
      logger.warn(`[Gemini] API error response (attempt ${attemptNumber}):`, data.error)

      // Check if we should retry
      if (shouldRetry(data.error, attemptNumber, MAX_RETRIES)) {
        const delay = getRetryDelay(attemptNumber)
        logger.log(`[Gemini] Retrying in ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return callGemini(payload, attemptNumber + 1)
      }

      logGeminiError(data.error, "response")
      throw new Error(data.error)
    }

    // Success
    const text = data?.text || ""
    logger.log(`[Gemini] Response received (${text.length} chars)`)
    return text
  } catch (err: any) {
    logger.error(`[Gemini] Unexpected error during invocation (attempt ${attemptNumber}):`, err)

    // Check if we should retry
    if (shouldRetry(err, attemptNumber, MAX_RETRIES)) {
      const delay = getRetryDelay(attemptNumber)
      logger.log(`[Gemini] Retrying in ${delay}ms...`)
      await new Promise((resolve) => setTimeout(resolve, delay))
      return callGemini(payload, attemptNumber + 1)
    }

    throw err
  }
}

/**
 * Summarizes patient notes or converts unstructured notes into SOAP format.
 */
export const analyzePatientNotes = async (notes: string): Promise<string> => {
  try {
    logger.log("[Gemini] Analyzing patient notes...")

    const result = await callGemini({
      prompt: `You are a medical assistant for a clinic in Kenya.
      Analyze the following patient notes and format them into a concise SOAP (Subjective, Objective, Assessment, Plan) format.
      Keep it brief and professional.

      Notes: "${notes}"`,
      model: "gemini-1.5-flash",
    })

    logger.log("[Gemini] Patient notes analysis completed")
    return result
  } catch (error) {
    logGeminiError(error, "analyzePatientNotes")
    const errorInfo = categorizeGeminiError(error, "analyzePatientNotes")
    const userMessage = getGeminiErrorMessage(errorInfo)
    throw new Error(userMessage)
  }
}

/**
 * Generates a short, friendly SMS reminder for a patient.
 */
export const draftAppointmentSms = async (patientName: string, date: string, reason: string): Promise<string> => {
  try {
    logger.log("[Gemini] Drafting appointment SMS reminder...")

    const text = await callGemini({
      prompt: `Draft a short, polite, and friendly SMS reminder (max 160 chars) for a patient named ${patientName}.
        They have an appointment for "${reason}" on ${date}.
        The tone should be professional but caring, suitable for a small clinic in Kenya.
        You can use a mix of English and Swahili (Sheng) if it sounds natural, but primarily English.
        Do not include placeholders like [Your Name]. Sign off as 'JuaAfya Clinic'.`,
      model: "gemini-1.5-flash",
    })

    logger.log("[Gemini] SMS reminder drafted successfully")
    return text?.trim().replace(/^"|"$/g, "") || "Could not draft SMS."
  } catch (error) {
    logGeminiError(error, "draftAppointmentSms")
    const errorInfo = categorizeGeminiError(error, "draftAppointmentSms")
    const userMessage = getGeminiErrorMessage(errorInfo)
    throw new Error(userMessage)
  }
}

/**
 * Generates marketing or general broadcast SMS content.
 */
export const draftCampaignMessage = async (topic: string, tone: string): Promise<string> => {
  try {
    logger.log("[Gemini] Drafting campaign message...")

    const text = await callGemini({
      prompt: `Draft a short, engaging SMS broadcast (max 160 chars) for a health clinic in Kenya.
        Topic: "${topic}"
        Tone: ${tone} (e.g., Professional, Urgent, Friendly, Educational).
        Target Audience: Patients.
        Language: English (can use common Kenyan phrases if appropriate).
        Call to action: Visit JuaAfya Clinic or call +254712345678.
        Do not use placeholders.`,
      model: "gemini-1.5-flash",
    })

    logger.log("[Gemini] Campaign message drafted successfully")
    return text?.trim().replace(/^"|"$/g, "") || "Could not draft campaign."
  } catch (error) {
    logGeminiError(error, "draftCampaignMessage")
    const errorInfo = categorizeGeminiError(error, "draftCampaignMessage")
    const userMessage = getGeminiErrorMessage(errorInfo)
    throw new Error(userMessage)
  }
}

/**
 * Generates a daily executive summary for the doctor based on stats.
 */
export const generateDailyBriefing = async (
  appointmentCount: number,
  lowStockCount: number,
  revenueEstimate: string,
): Promise<string> => {
  try {
    logger.log("[Gemini] Generating daily briefing...")

    const result = await callGemini({
      prompt: `You are an intelligent clinic operations assistant.
        Generate a 2-sentence "Daily Briefing" for the doctor.
        Data:
        - Appointments today: ${appointmentCount}
        - Low stock items: ${lowStockCount}
        - Est. Revenue: ${revenueEstimate}

        Highlight action items (like restocking) if necessary, otherwise be encouraging.`,
      model: "gemini-1.5-flash",
    })

    logger.log("[Gemini] Daily briefing generated successfully")
    return result
  } catch (error) {
    logGeminiError(error, "generateDailyBriefing")
    const errorInfo = categorizeGeminiError(error, "generateDailyBriefing")
    const userMessage = getGeminiErrorMessage(errorInfo)
    throw new Error(userMessage)
  }
}

/**
 * Staff WhatsApp Agent Response
 */
export const getStaffAssistantResponse = async (userQuery: string, context: any): Promise<any> => {
  try {
    logger.log("[Gemini] Processing staff assistant query...")

    const userRole = context.userRole || 'Receptionist';

    // Define available data based on Role
    let dataContext = `
        - Patients: ${JSON.stringify(context.patients || [])}
        - Appointments: ${JSON.stringify(context.appointments || [])}
        - Today: ${context.today}
    `;

    const normalizedRole = userRole.toLowerCase().replace(" ", "_");

    // Add sensitive data only for permitted roles
    if (['admin', 'superadmin', 'super_admin', 'doctor', 'pharmacist'].includes(normalizedRole)) {
      dataContext += `\n- Inventory: ${JSON.stringify(context.inventory || [])}`;
    }
    if (['admin', 'superadmin', 'super_admin', 'accountant'].includes(normalizedRole)) {
      dataContext += `\n- Billing/Transactions: ${JSON.stringify(context.transactions || [])}`;
      dataContext += `\n- Revenue Stats: ${JSON.stringify(context.revenue || {})}`;
    }

    // Define Actions based on Role
    let actions = `
        - ADD_PATIENT: payload { name, phone, age, gender (Male/Female) }
        - EDIT_PATIENT: payload { patientId, updates: { name?, phone?, age?, gender?, notes? } }
        - ADD_APPOINTMENT: payload { patientId, date (YYYY-MM-DD), time (HH:MM), reason }
        - CANCEL_APPOINTMENT: payload { appointmentId }
    `;

    if (['admin', 'superadmin', 'super_admin', 'pharmacist'].includes(normalizedRole)) {
      actions += `
        - UPDATE_STOCK: payload { itemId or itemName, newQuantity }
        - DELETE_ITEM: payload { itemId or itemName }`;
    }

    if (['admin', 'superadmin', 'super_admin', 'accountant'].includes(normalizedRole)) {
      actions += `
        - GENERATE_INVOICE: payload { patientId, amount, description }
        - RECORD_PAYMENT: payload { invoiceId, amount, method }
        - CHECK_REVENUE: payload { period (daily/monthly/yearly) }`;
    }

    const text = await callGemini({
      prompt: `You are the 'JuaAfya Ops Bot', a capable assistant for ${context.clinic?.name || "the clinic"}.
        User Role: ${userRole}.
        
        Current Data Context (Filtered by Role):
        ${dataContext}

        User Query: "${userQuery}"

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
        `,
      model: "gemini-1.5-flash",
      jsonMode: true,
    })

    // Clean up potential markdown code blocks
    const jsonStr = text.replace(/```json\n?|\n?```/g, "")

    try {
      const result = JSON.parse(jsonStr)
      logger.log("[Gemini] Staff assistant query processed successfully")
      return result
    } catch (parseError) {
      logger.warn("[Gemini] Failed to parse JSON response, returning fallback")
      return { reply: "I understood your request but had trouble formatting the response.", action: null }
    }
  } catch (error) {
    logGeminiError(error, "getStaffAssistantResponse")
    const errorInfo = categorizeGeminiError(error, "getStaffAssistantResponse")
    const userMessage = getGeminiErrorMessage(errorInfo)
    throw new Error(userMessage)
  }
}

// Chat history stored in memory for the session
const chatHistory: Array<{ role: string; text: string }> = []

export const getChatSession = () => {
  return { active: true }
}

// Helper to fetch context for the chat (Respects RLS/RBAC)
const fetchClinicContext = async (role: string) => {
  try {
    // 1. Get current date for filtering
    const today = new Date().toISOString().split('T')[0]

    const normalizedRole = role.toLowerCase().replace(" ", "_")

    // Super Admin gets platform-wide context
    if (normalizedRole === 'superadmin' || normalizedRole === 'super_admin') {
      const [
        { count: totalClinics },
        { count: activeClinics },
        { count: pendingClinics },
        { count: totalPatients },
      ] = await Promise.all([
        supabase.from('clinics').select('*', { count: 'exact', head: true }),
        supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('patients').select('*', { count: 'exact', head: true }),
      ])

      return `
      Platform Overview (Super Admin):
      - Total Clinics: ${totalClinics || 0}
      - Active Clinics: ${activeClinics || 0}
      - Pending Approvals: ${pendingClinics || 0}
      - Total Patients (All Clinics): ${totalPatients || 0}
      - Today's Date: ${today}
      
      You have full platform access. You can help with clinic approvals, system-wide statistics, and platform management.
      `
    }

    // 2. Fetch summary data in parallel (Base data available to all staff)
    const [
      { count: patientCount },
      { data: appointments },
    ] = await Promise.all([
      supabase.from('patients').select('*', { count: 'exact', head: true }),
      supabase.from('appointments').select('*').gte('date', today).order('date').limit(10),
    ])

    let sensitiveContext = "";

    // 3. Fetch RBAC-Restricted Data
    if (['admin', 'superadmin', 'super_admin', 'doctor', 'pharmacist'].includes(normalizedRole)) {
      const { count: lowStockCount } = await supabase.from('inventory').select('*', { count: 'exact', head: true }).lt('stock', 10);
      sensitiveContext += `\n    - Low Stock Items Count: ${lowStockCount || 0}`;
    }

    if (['admin', 'superadmin', 'super_admin', 'accountant'].includes(normalizedRole)) {
      const { data: todaysVisits } = await supabase.from('visits').select('total_bill, payment_status').eq('start_time', today);
      const { data: monthlyVisits } = await supabase.from('visits').select('total_bill, payment_status').gte('start_time', today.substring(0, 7) + '-01');

      const dailyRevenue = (todaysVisits || [])
        .filter((v: any) => v.payment_status === 'Paid')
        .reduce((sum: number, v: any) => sum + (v.total_bill || 0), 0);

      const monthlyRevenue = (monthlyVisits || [])
        .filter((v: any) => v.payment_status === 'Paid')
        .reduce((sum: number, v: any) => sum + (v.total_bill || 0), 0);

      sensitiveContext += `\n    - Today's Revenue (kES): ${dailyRevenue.toLocaleString()}`;
      sensitiveContext += `\n    - Monthly Revenue (kES): ${monthlyRevenue.toLocaleString()}`;
    }

    // 4. Format context string
    return `
    Current System Context (Read-Only):
    - Total Patients: ${patientCount || 0}
    - Upcoming Appointments (Next 10): ${appointments?.length ? JSON.stringify(appointments.map((a: any) => ({ date: a.date, time: a.time, patient: a.patient_name, reason: a.reason }))) : "None"}
    ${sensitiveContext}
    - Today's Date: ${today}
    `
  } catch (error) {
    logger.error("[Gemini] Failed to fetch clinic context:", error)
    return ""
  }
}

export const sendMessageToChat = async (message: string, cachedUserRole?: string): Promise<string> => {
  try {
    logger.log("[Gemini] Chat message received, adding to history")
    chatHistory.push({ role: "user", text: message })

    // Use cached role if provided, otherwise fetch from database
    let userRole = cachedUserRole || 'Receptionist';

    if (!cachedUserRole) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
        if (profile) userRole = profile.role;
      }
    }

    logger.log(`[Gemini] Using role: ${userRole} (cached: ${!!cachedUserRole})`)

    // Fetch context respecting RBAC/RLS
    const systemContext = await fetchClinicContext(userRole)

    const reply = await callGemini({
      prompt: message,
      history: chatHistory.slice(0, -1),

      systemInstruction:
        `You are 'Candy', a helpful AI assistant for a small health clinic in Kenya. 
        User Role: ${userRole}.
        
        You have access to the following real-time clinic data (Filtered strictly by the user's role):
        ${systemContext}

        Use this data to answer questions like "How many patients do I have?" or "Any appointments today?".
        If the user asks for data not in this summary (e.g. Revenue if they are a Nurse), explain that you do not have permission to access that data.
        
        You help the clinic staff with general medical questions, drafting SMS reminders, interpreting lab results, and suggesting operational improvements. 
        You are NOT a doctor and must clarify that your advice does not replace professional medical judgment. Keep answers concise and friendly.`,
      model: "gemini-1.5-flash",
    })

    logger.log("[Gemini] Chat response received, adding to history")
    chatHistory.push({ role: "model", text: reply })

    return reply

  } catch (error) {
    logGeminiError(error, "sendMessageToChat")

    // Check if it's a configuration error
    const errorInfo = categorizeGeminiError(error, "sendMessageToChat")

    // For chat, we want to show a user-friendly message but still track the error
    let fallbackReply: string

    if (errorInfo.type === "API_KEY_NOT_CONFIGURED") {
      fallbackReply = "The AI assistant is not configured. Please contact your administrator to set up the Gemini API key."
    } else if (errorInfo.isRetryable) {
      fallbackReply = "The AI assistant is temporarily unavailable. Please try again in a moment."
    } else {
      fallbackReply = `I encountered an issue: ${errorInfo.message} Please try again later.`
    }

    logger.log(`[Gemini] Using fallback message: ${fallbackReply}`)
    chatHistory.push({ role: "model", text: fallbackReply })
    return fallbackReply
  }
}

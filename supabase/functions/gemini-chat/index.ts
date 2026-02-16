// @ts-ignore
// Setup type definitions for built-in Supabase Query configurations
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
// @ts-ignore
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts'

// Helper to log to console (visible in Supabase logs)
function logMessage(message: string, context?: any) {
    console.log(`[Gemini Edge Function] ${message}`, context || "")
}

function logError(message: string, error?: any) {
    console.error(`[Gemini Edge Function] ERROR: ${message}`, error || "")
}

// Helper to create structured error responses
function createErrorResponse(errorType: string, message: string, details?: any) {
    return {
        error: message,
        errorType: errorType,
        details: details,
        helpUrl: getHelpUrl(errorType),
    }
}

// Helper to get appropriate help URL based on error type
function getHelpUrl(errorType: string): string {
    switch (errorType) {
        case "API_KEY_NOT_CONFIGURED":
            return "https://aistudio.google.com/"
        case "INVALID_API_KEY":
            return "https://aistudio.google.com/"
        case "RATE_LIMITED":
            return "https://console.cloud.google.com/"
        default:
            return "https://aistudio.google.com/"
    }
}

async function listAvailableModels(apiKey: string, signal: AbortSignal) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    logMessage("Fetching list of available models...");

    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        // @ts-ignore
        signal: signal,
    });

    const data = await response.json();
    return { response, data };
}

async function tryGenerateContent(model: string, payload: any, apiKey: string, signal: AbortSignal) {
    // Ensure model name doesn't already have 'models/' prefix
    const cleanModelName = model.replace('models/', '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelName}:generateContent?key=${apiKey}`;
    logMessage(`Attempting request with model: ${cleanModelName}`)

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        // @ts-ignore
        signal: signal,
    });

    const data = await response.json();
    return { response, data };
}

// @ts-ignore
import { authenticateRequest } from '../_shared/auth.ts'
// @ts-ignore
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts'

// @ts-ignore
Deno.serve(async (req) => {
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

        logMessage("Request received from authenticated user: " + user.email)

        // Parse request body
        let body;
        try {
            body = await req.json()
        } catch (e) {
            logError("Failed to parse request JSON", e)
            return new Response(
                JSON.stringify(createErrorResponse("INVALID_JSON", "Invalid JSON in request body")),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )
        }

        const { prompt, history, systemInstruction, model, temperature, jsonMode } = body

        logMessage("Parsing request body...", { model, hasPrompt: !!prompt })

        // Validate request
        if (!prompt && (!history || history.length === 0)) {
            logError("Invalid request: no prompt or history provided")
            return new Response(
                JSON.stringify(createErrorResponse(
                    "INVALID_REQUEST",
                    "No prompt or history provided in request"
                )),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )
        }

        // Get API Key from Environment Variable
        // @ts-ignore
        const apiKey = (globalThis as any).Deno?.env.get('GEMINI_API_KEY');

        if (!apiKey) {
            logError("GEMINI_API_KEY not configured in environment")
            return new Response(
                JSON.stringify(createErrorResponse(
                    "API_KEY_NOT_CONFIGURED",
                    "GEMINI_API_KEY is not configured in environment variables. Please add it via 'supabase secrets set GEMINI_API_KEY=...'"
                )),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } } // Return 200 to let frontend handle it gracefully
            )
        }

        logMessage("Building payload...", { model, hasPrompt: !!prompt, historyLength: history?.length || 0 })

        const payload: any = {
            contents: [
                ...(history || []).map((msg: any) => ({
                    role: msg.role === 'admin' ? 'model' : msg.role, // Map common roles
                    parts: [{ text: msg.text || msg.parts?.[0]?.text }]
                }))
            ],
            generationConfig: {
                temperature: temperature || 0.7,
            }
        };

        if (prompt) {
            payload.contents.push({
                role: "user",
                parts: [{ text: prompt }]
            });
        }

        if (systemInstruction) {
            // gemini-1.5-pro-latest and gemini-2.0-flash support system_instruction
            payload.systemInstruction = {
                parts: [{ text: systemInstruction }]
            };
        }

        if (jsonMode) {
            payload.generationConfig.responseMimeType = "application/json";
        }

        // Define fallback models
        const requestedModel = model || "gemini-1.5-flash";
        // Order of fallback: requested -> latest aliases -> specific versions -> old pro
        const fallbackModels = [
            requestedModel,
            "gemini-2.0-flash-exp",
            "gemini-1.5-flash-latest",
            "gemini-1.5-pro-latest",
            "gemini-1.5-flash-001",
            "gemini-1.5-flash-002",
            "gemini-1.5-pro",
            "gemini-pro",
            "gemini-1.0-pro"
        ];

        // Remove duplicates
        const uniqueModels = [...new Set(fallbackModels)];

        let lastError = null;
        let successResponse = null;

        // Add timeout for Gemini API call (60 seconds - increased for multiple retries)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 60000)

        // Track tried models to avoid retrying them if found dynamically later
        const triedModels = new Set();

        try {
            // 1. Try Hardcoded Models
            for (const modelName of uniqueModels) {
                if (!modelName) continue;
                triedModels.add(modelName);

                try {
                    const { response, data } = await tryGenerateContent(modelName, payload, apiKey, controller.signal);

                    if (response.ok) {
                        logMessage(`Successfully generated content with model: ${modelName}`);
                        successResponse = { response, data };
                        break;
                    } else {
                        const errorMessage = data.error?.message || data.error || response.statusText;
                        logMessage(`Model ${modelName} failed: ${errorMessage}`);

                        lastError = { status: response.status, data, errorType: "GEMINI_API_ERROR" };
                    }
                } catch (e: any) {
                    logMessage(`Error trying model ${modelName}:`, e);
                    lastError = { error: e, errorType: "NETWORK_ERROR" };
                }
            }

            // 2. If all hardcoded models fail, try to dynamically list models
            if (!successResponse) {
                logMessage("All legacy fallback models failed. Attempting to list available models from API...");

                try {
                    const { response: listResponse, data: listData } = await listAvailableModels(apiKey, controller.signal);

                    if (listResponse.ok && listData.models) {
                        const availableModels = listData.models
                            .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
                            .map((m: any) => m.name.replace('models/', ''))
                            .filter((name: string) => !triedModels.has(name)); // Only try new ones

                        logMessage(`Found ${availableModels.length} new available models: ${availableModels.join(', ')}`);

                        // Sort to prefer "flash" or "pro" models
                        availableModels.sort((a: string, b: string) => {
                            if (a.includes('flash') && !b.includes('flash')) return -1;
                            if (b.includes('flash') && !a.includes('flash')) return 1;
                            return 0;
                        });

                        // Try the dynamic models
                        for (const modelName of availableModels) {
                            logMessage(`Trying dynamic model: ${modelName}`);
                            try {
                                const { response, data } = await tryGenerateContent(modelName, payload, apiKey, controller.signal);
                                if (response.ok) {
                                    logMessage(`Successfully generated content with dynamic model: ${modelName}`);
                                    successResponse = { response, data };
                                    break;
                                } else {
                                    // Log but keep trying
                                    const errorMessage = data.error?.message || data.error || response.statusText;
                                    logMessage(`Dynamic model ${modelName} failed: ${errorMessage}`);
                                }
                            } catch (e) {
                                logMessage(`Dynamic model ${modelName} network error`, e);
                            }
                        }

                    } else {
                        logError("Failed to list models or no models returned", listData);
                        lastError = { status: listResponse.status, data: listData, errorType: "GEMINI_LIST_ERROR" };
                    }
                } catch (e: any) {
                    logError("Failed to list available models", e);
                    lastError = { error: e, errorType: "NETWORK_ERROR" };
                }
            }

        } finally {
            clearTimeout(timeoutId);
        }

        if (successResponse) {
            const { data } = successResponse;
            // Extract text from response
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

            if (!text) {
                logError("Empty response from Gemini API")
                return new Response(
                    JSON.stringify(createErrorResponse(
                        "EMPTY_RESPONSE",
                        "Gemini API returned empty response"
                    )),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                )
            }

            logMessage("Response received successfully", { length: text.length })

            return new Response(
                JSON.stringify({ text, raw: data }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } },
            )
        }

        // If we get here, absolutely everything failed
        logError("All models (static and dynamic) failed.");

        const errorMessage = lastError?.data?.error?.message || lastError?.error?.message || "Available models failed to respond";
        const errorDetails = lastError?.data?.error // Include full error object

        return new Response(
            JSON.stringify(createErrorResponse(
                "MODEL_UNAVAILABLE",
                `Failed to generate content. ${errorMessage}. checked dynamic list.`,
                errorDetails
            )),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )

    } catch (error: any) {
        logError("Unexpected error in edge function:", error)

        // Determine error type
        let errorType = "UNKNOWN_ERROR"
        let statusCode = 500

        if (error.name === "AbortError") {
            errorType = "TIMEOUT"
            logError("Request timeout after 60 seconds")
        } else if (error.message?.includes("network") || error.message?.includes("ECONNREFUSED")) {
            errorType = "NETWORK_ERROR"
        }

        return new Response(
            JSON.stringify(createErrorResponse(
                errorType,
                error.message || "An unexpected error occurred"
            )),
            { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
    }
})

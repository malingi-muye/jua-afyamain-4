/**
 * Gemini Error Handler and Retry Logic
 * Categorizes errors and determines retry strategy
 */

import logger from "../logger"

export type GeminiErrorType =
  | "API_KEY_NOT_CONFIGURED"
  | "INVALID_API_KEY"
  | "RATE_LIMITED"
  | "NETWORK_TIMEOUT"
  | "TEMPORARY_UNAVAILABLE"
  | "EDGE_FUNCTION_ERROR"
  | "INVALID_REQUEST"
  | "UNSUPPORTED_MODEL"
  | "UNKNOWN_ERROR"

export interface GeminiErrorInfo {
  type: GeminiErrorType
  message: string
  originalError?: Error | any
  isRetryable: boolean
  helpUrl?: string
}

/**
 * Categorize a Gemini error into a known type
 * Returns error info with retry flag and helpful message
 */
export function categorizeGeminiError(error: any, context?: string): GeminiErrorInfo {
  const errorStr = String(error?.message || error || "")
  const errorLower = errorStr.toLowerCase()

  logger.warn(`[Gemini] Categorizing error${context ? ` (${context})` : ""}: ${errorStr}`)

  // Configuration errors - not retryable
  if (
    errorLower.includes("gemini_api_key") ||
    errorLower.includes("api_key is not configured") ||
    errorLower.includes("not configured in environment")
  ) {
    return {
      type: "API_KEY_NOT_CONFIGURED",
      message: "Gemini API key is not configured. Please set GEMINI_API_KEY in Supabase secrets.",
      originalError: error,
      isRetryable: false,
      helpUrl: "https://aistudio.google.com/",
    }
  }

  if (
    errorLower.includes("401") ||
    errorLower.includes("unauthenticated") ||
    errorLower.includes("permission denied") ||
    errorLower.includes("invalid api key")
  ) {
    return {
      type: "INVALID_API_KEY",
      message: "Gemini API key is invalid or expired.",
      originalError: error,
      isRetryable: false,
      helpUrl: "https://aistudio.google.com/",
    }
  }

  // Rate limiting - retryable with backoff
  if (errorLower.includes("429") || errorLower.includes("rate limit") || errorLower.includes("too many requests")) {
    return {
      type: "RATE_LIMITED",
      message: "Gemini API rate limit exceeded. Please try again shortly.",
      originalError: error,
      isRetryable: true,
    }
  }

  // Network errors - retryable
  if (
    errorLower.includes("timeout") ||
    errorLower.includes("timed out") ||
    errorLower.includes("econnrefused") ||
    errorLower.includes("network")
  ) {
    return {
      type: "NETWORK_TIMEOUT",
      message: "Network timeout while connecting to Gemini API.",
      originalError: error,
      isRetryable: true,
    }
  }

  // Temporary unavailable - retryable
  if (errorLower.includes("503") || errorLower.includes("service unavailable") || errorLower.includes("temporarily unavailable")) {
    return {
      type: "TEMPORARY_UNAVAILABLE",
      message: "Gemini API is temporarily unavailable.",
      originalError: error,
      isRetryable: true,
    }
  }

  // Edge function errors
  if (errorLower.includes("edge function") || errorLower.includes("invoke")) {
    return {
      type: "EDGE_FUNCTION_ERROR",
      message: "Failed to invoke Gemini edge function.",
      originalError: error,
      isRetryable: true,
    }
  }

  // Request validation errors - not retryable
  if (
    errorLower.includes("invalid request") ||
    errorLower.includes("bad request") ||
    errorLower.includes("400") ||
    errorLower.includes("validation")
  ) {
    return {
      type: "INVALID_REQUEST",
      message: "Invalid request to Gemini API.",
      originalError: error,
      isRetryable: false,
    }
  }

  // Model errors - not retryable
  if (errorLower.includes("model") || errorLower.includes("not found")) {
    return {
      type: "UNSUPPORTED_MODEL",
      message: "Gemini model not found or not supported.",
      originalError: error,
      isRetryable: false,
    }
  }

  // Unknown error - don't retry unknown errors by default
  return {
    type: "UNKNOWN_ERROR",
    message: errorStr || "Unknown error from Gemini API",
    originalError: error,
    isRetryable: false,
  }
}

/**
 * Get the retry delay in milliseconds based on attempt number
 * Implements exponential backoff: 1s, 2s, 4s
 */
export function getRetryDelay(attemptNumber: number): number {
  // Exponential backoff: 1s, 2s, 4s
  const baseDelay = 1000 // 1 second
  const delay = baseDelay * Math.pow(2, attemptNumber - 1)
  
  // Add some jitter to avoid thundering herd (±10%)
  const jitter = delay * 0.1 * (Math.random() * 2 - 1)
  return Math.max(100, delay + jitter)
}

/**
 * Check if an error should be retried
 * Returns true if we should attempt again
 */
export function shouldRetry(error: any, attemptNumber: number = 1, maxAttempts: number = 3): boolean {
  if (attemptNumber >= maxAttempts) {
    logger.log(`[Gemini] Max retry attempts (${maxAttempts}) reached`)
    return false
  }

  const errorInfo = categorizeGeminiError(error)
  return errorInfo.isRetryable
}

/**
 * Get a user-friendly error message based on the error type
 */
export function getGeminiErrorMessage(errorInfo: GeminiErrorInfo): string {
  switch (errorInfo.type) {
    case "API_KEY_NOT_CONFIGURED":
      return "AI features are not configured. Please contact your administrator to set up the Gemini API key."

    case "INVALID_API_KEY":
      return "The Gemini API key is invalid. Please check your configuration."

    case "RATE_LIMITED":
      return "Too many requests. The AI service is temporarily busy. Please try again in a moment."

    case "NETWORK_TIMEOUT":
      return "Network connection timeout. Please check your internet connection and try again."

    case "TEMPORARY_UNAVAILABLE":
      return "The AI service is temporarily unavailable. Please try again shortly."

    case "EDGE_FUNCTION_ERROR":
      return "Failed to connect to the AI service. Please try again."

    case "INVALID_REQUEST":
      return "There was an issue with your request. Please try again with different input."

    case "UNSUPPORTED_MODEL":
      return "The AI model is not available. Please contact support."

    case "UNKNOWN_ERROR":
    default:
      return "An unexpected error occurred with the AI service. Please try again later."
  }
}

/**
 * Log error with context for debugging
 */
export function logGeminiError(error: any, context?: string) {
  const errorInfo = categorizeGeminiError(error, context)
  logger.error(
    `[Gemini] ${errorInfo.type}${context ? ` (${context})` : ""}: ${errorInfo.message}`,
    errorInfo.originalError
  )
}

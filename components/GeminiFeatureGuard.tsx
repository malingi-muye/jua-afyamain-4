"use client"

import React, { useEffect, useState } from "react"
import { AlertCircle, Settings } from "lucide-react"
import { isGeminiAvailable, getGeminiStatus } from "@/lib/gemini/config-check"
import logger from "@/lib/logger"

interface GeminiFeatureGuardProps {
  children: React.ReactNode
  featureName?: string
  fallback?: React.ReactNode
}

/**
 * Wrapper component that conditionally renders Gemini-dependent features
 * Shows a user-friendly message if Gemini is not available
 */
export default function GeminiFeatureGuard({
  children,
  featureName = "AI feature",
  fallback,
}: GeminiFeatureGuardProps) {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const available = await isGeminiAvailable()
        setIsAvailable(available)

        if (!available) {
          const status = await getGeminiStatus()
          setError(status.reason || "Gemini is not available")
          logger.warn(`[GeminiFeatureGuard] ${featureName} is unavailable:`, status.error)
        }
      } catch (err) {
        logger.error(`[GeminiFeatureGuard] Error checking availability for ${featureName}:`, err)
        setIsAvailable(false)
        setError("Could not check AI availability")
      }
    }

    checkAvailability()
  }, [featureName])

  // Still checking availability
  if (isAvailable === null) {
    return (
      <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 bg-slate-400 rounded-full animate-pulse"></div>
          <p className="text-sm text-slate-600 dark:text-slate-400">Checking AI availability...</p>
        </div>
      </div>
    )
  }

  // Feature is available
  if (isAvailable) {
    return <>{children}</>
  }

  // Feature is not available - show fallback or default message
  if (fallback) {
    return <>{fallback}</>
  }

  // Default unavailable state
  return (
    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-1">
            {featureName} is not available
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-200 mb-3">
            {error || "The AI feature is currently disabled. Please contact your administrator."}
          </p>
          <a
            href="https://aistudio.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 hover:underline"
          >
            <Settings className="w-3 h-3" />
            Setup Instructions
          </a>
        </div>
      </div>
    </div>
  )
}

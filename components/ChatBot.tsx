"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { Send, X, Bot, Loader2, Sparkles, AlertCircle, WifiOff } from "lucide-react"
import type { ChatMessage } from "../types"
import { sendMessageToChat } from "../services/geminiService"
import { isGeminiAvailable, getGeminiStatus, clearGeminiStatusCache } from "../lib/gemini/config-check"
import logger from "../lib/logger"

const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  // Start as null (unknown) — we won't check until user opens the chat
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "model",
      text: "Hello! I am Candy, your clinic assistant. I can help with patient notes, operational questions, or medical info. How can I help?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasInitialized = useRef(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // Deferred initialization — only runs when chat is opened
  const checkAvailability = useCallback(async () => {
    if (hasInitialized.current) return
    hasInitialized.current = true
    setIsChecking(true)

    // Check Gemini availability
    logger.log("[ChatBot] Checking Gemini availability (deferred)...")
    try {
      const available = await isGeminiAvailable()
      setIsAvailable(available)

      if (!available) {
        const status = await getGeminiStatus()
        setAvailabilityError(status.reason || "Gemini is not available")
        logger.warn("[ChatBot] Gemini is not available:", status.error, status.reason)
      } else {
        setAvailabilityError(null)
        logger.log("[ChatBot] Gemini is available")
      }
    } catch (error) {
      logger.error("[ChatBot] Error checking Gemini availability:", error)
      setIsAvailable(false)
      setAvailabilityError("Could not check AI availability")
    } finally {
      setIsChecking(false)
    }

    // Fetch user role in background (non-blocking)
    try {
      const { supabase } = await import("../lib/supabaseClient")
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
        if (profile) {
          setUserRole(profile.role)
          logger.log(`[ChatBot] User role cached: ${profile.role}`)
        }
      }
    } catch (error) {
      logger.warn("[ChatBot] Failed to fetch user role:", error)
      setUserRole('Receptionist') // Fallback
    }
  }, [])

  // When chat opens, trigger deferred initialization
  useEffect(() => {
    if (isOpen && !hasInitialized.current) {
      checkAvailability()
    }
  }, [isOpen, checkAvailability])

  useEffect(() => {
    if (isOpen) scrollToBottom()
  }, [messages, isOpen])

  const handleSend = async () => {
    if (!input.trim() || isLoading || !isAvailable) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      text: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsLoading(true)
    setHasError(false)

    try {
      logger.log("[ChatBot] Sending message to Gemini...")
      const responseText = await sendMessageToChat(userMsg.text, userRole || 'Receptionist')

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "model",
        text: responseText,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, botMsg])
    } catch (error) {
      logger.error("[ChatBot] Error sending message:", error)
      setHasError(true)

      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "model",
        text: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const handleRetry = async () => {
    logger.log("[ChatBot] Retrying Gemini availability check...")
    hasInitialized.current = false
    clearGeminiStatusCache()
    await checkAvailability()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Determine effective availability for the button
  // Before checking: show button as available (optimistic)
  // While checking: show button as available (loading state inside chat window)
  // After checking: show actual state
  const buttonAvailable = isAvailable === null ? true : isAvailable

  return (
    <>
      {/* Floating Button with Enhanced Animation */}
      <div className={`fixed bottom-6 right-4 sm:bottom-10 sm:right-6 md:bottom-10 md:right-10 z-[110] flex flex-col items-end space-y-2 pointer-events-none ${isOpen ? "hidden" : "flex"}`}>

        {/* Helper tooltip/bubble that appears sometimes */}
        {!isOpen && buttonAvailable && (
          <div className="animate-in fade-in slide-in-from-right-5 duration-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-4 py-2 rounded-2xl rounded-tr-sm shadow-xl border border-slate-100 dark:border-slate-700 mb-2 mr-2 max-w-[200px] pointer-events-auto cursor-pointer" onClick={() => setIsOpen(true)}>
            <p className="text-sm font-medium">Need help with patient notes?</p>
          </div>
        )}

        <button
          onClick={() => setIsOpen(true)}
          className={`w-14 h-14 md:w-16 md:h-16 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:scale-110 active:scale-95 transition-all flex items-center justify-center group pointer-events-auto relative overflow-hidden bg-gradient-to-br from-[#063a33] to-[#0a5c50] text-white`}
        >
          <span className="absolute inset-0 bg-white/20 rounded-full animate-ping opacity-75 duration-[3000ms]"></span>
          <Sparkles className="w-6 h-6 md:w-7 md:h-7 group-hover:rotate-12 transition-transform relative z-10" />

          {/* Status Indicator Dot */}
          <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full border-2 border-[#063a33] z-20 ${isAvailable === false ? "bg-red-400" : "bg-green-400"}`}></span>
        </button>
      </div>

      {/* Chat Window with Glassmorphism and Premium Feel */}
      {isOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-10 sm:right-10 sm:w-[380px] sm:h-[600px] md:w-[420px] md:h-[650px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl sm:rounded-[2rem] shadow-2xl z-[110] flex flex-col border border-white/20 dark:border-slate-700/50 overflow-hidden animate-in slide-in-from-bottom-10 zoom-in-95 duration-300 font-sans m-0 sm:m-0 ring-1 ring-black/5 dark:ring-white/5">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#063a33] to-[#0d5f54] px-5 sm:px-6 py-5 flex items-center justify-between text-white shrink-0 shadow-lg relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>

            <div className="flex items-center space-x-3 min-w-0 relative z-10">
              <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-md flex-shrink-0 shadow-inner ring-1 ring-white/20">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-lg tracking-tight truncate font-heading">Candy</h3>
                <div className="flex items-center space-x-1.5 opacity-90">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isChecking ? "bg-yellow-400 animate-pulse" : isAvailable ? "bg-green-400 animate-pulse" : isAvailable === false ? "bg-red-400" : "bg-yellow-400 animate-pulse"}`}></span>
                  <span className="text-xs uppercase font-semibold tracking-wider text-green-50">
                    {isChecking ? "Connecting..." : isAvailable ? "Online" : isAvailable === false ? "Offline" : "Connecting..."}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-white/20 rounded-full transition-colors flex-shrink-0 relative z-10"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4 bg-slate-50/50 dark:bg-slate-900/50 scroll-smooth">
            {/* Show checking state */}
            {isChecking && (
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 text-center animate-in fade-in zoom-in duration-300">
                <Loader2 className="w-8 h-8 text-blue-500 mx-auto mb-2 animate-spin" />
                <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-1">Connecting to AI...</h4>
                <p className="text-sm text-blue-600 dark:text-blue-400">Checking Gemini availability</p>
              </div>
            )}

            {/* Show error state only after check completed */}
            {!isChecking && isAvailable === false && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-center animate-in fade-in zoom-in duration-300">
                <WifiOff className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <h4 className="font-bold text-red-800 dark:text-red-300 mb-1">Service Unavailable</h4>
                <p className="text-sm text-red-600 dark:text-red-400 mb-3">{availabilityError || "Gemini AI connection failed."}</p>
                <button onClick={handleRetry} className="text-xs bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 text-red-800 dark:text-red-100 px-3 py-1.5 rounded-lg font-medium transition-colors">
                  Retry Connection
                </button>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className={`flex flex-col max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className={`px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed shadow-sm break-words relative ${msg.role === "user"
                      ? "bg-gradient-to-br from-teal-600 to-teal-700 text-white rounded-br-none shadow-teal-900/10"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-bl-none shadow-slate-200/50 dark:shadow-none"
                      }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start animate-in fade-in duration-300">
                <div className="bg-white dark:bg-slate-800 px-5 py-4 rounded-2xl rounded-bl-none border border-slate-100 dark:border-slate-700 shadow-sm flex items-center space-x-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce"></div>
                  </div>
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Candy is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Error Banner */}
          {hasError && (
            <div className="px-5 py-3 bg-orange-50 dark:bg-orange-900/20 border-t border-orange-100 dark:border-orange-800 flex items-center justify-between shrink-0">
              <span className="text-xs font-medium text-orange-700 dark:text-orange-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Message failed to send.
              </span>
              <button onClick={handleRetry} className="text-xs underline text-orange-800 dark:text-orange-200 hover:text-orange-900">Retry</button>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 sm:p-5 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 shrink-0">
            <div className="relative flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded-[1.25rem] border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-500 transition-all shadow-inner">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask about patients, scheduling..."
                disabled={isLoading || !isAvailable}
                className="w-full pl-4 pr-12 py-3 bg-transparent border-0 focus:outline-none text-sm sm:text-base text-slate-800 dark:text-white placeholder:text-slate-400 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading || !isAvailable}
                className={`absolute right-1.5 p-2.5 rounded-xl transition-all shadow-sm flex-shrink-0 ${!input.trim() || isLoading || !isAvailable ? 'bg-slate-200 dark:bg-slate-700 text-slate-400' : 'bg-gradient-to-tr from-teal-600 to-teal-500 text-white hover:shadow-md hover:scale-105 active:scale-95'}`}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <div className="mt-2 text-center">
              <p className="text-[10px] text-slate-400 dark:text-slate-500">AI can make mistakes. Verify important medical info.</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
export default ChatBot

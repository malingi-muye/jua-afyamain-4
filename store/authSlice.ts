import type { StateCreator } from "zustand"
import type { TeamMember, ClinicSettings, Notification } from "../types"
import { supabase } from "../lib/supabaseClient"
import { getDefaultViewForRole } from "../lib/rbac"
import logger from '../lib/logger'

const getLocalStorage = (key: string): string | null => {
    if (typeof window !== "undefined") {
        return localStorage.getItem(key)
    }
    return null
}

const setLocalStorage = (key: string, value: string): void => {
    if (typeof window !== "undefined") {
        localStorage.setItem(key, value)
    }
}

const removeLocalStorage = (key: string): void => {
    if (typeof window !== "undefined") {
        localStorage.removeItem(key)
    }
}

export interface AuthSlice {
    currentUser: TeamMember | null
    isAppLoading: boolean
    isDemoMode: boolean
    darkMode: boolean
    currentView: string
    toasts: Notification[]
    actions: {
        setCurrentView: (view: string) => void
        setIsAppLoading: (isLoading: boolean) => void
        setIsDemoMode: (isDemo: boolean) => void
        toggleTheme: () => void
        login: (user: TeamMember) => void
        logout: () => Promise<void>
        switchUser: (user: TeamMember) => void
        showToast: (message: string, type?: "success" | "error" | "info") => void
    }
}

export const createAuthSlice: StateCreator<
    AuthSlice & { actions: { fetchData: () => Promise<void> } },
    [],
    [],
    AuthSlice
> = (set, get) => ({
    currentUser: null,
    isAppLoading: true,
    // Respect build-time demo flag — cannot be toggled at runtime unless allowed
    isDemoMode: import.meta.env.VITE_ALLOW_DEMO_MODE === "true",
    darkMode: getLocalStorage("theme") === "dark",
    currentView: "dashboard",
    toasts: [],
    actions: {
        setCurrentView: (view) => set({ currentView: view }),
        setIsAppLoading: (isLoading) => set({ isAppLoading: isLoading }),
        setIsDemoMode: (isDemo) => {
            const ALLOW_DEMO = import.meta.env.VITE_ALLOW_DEMO_MODE === "true"
            if (!ALLOW_DEMO) {
                logger.warn('Demo mode is disabled in this build. To enable, set VITE_ALLOW_DEMO_MODE=true at build time.')
                return
            }
            set({ isDemoMode: isDemo })
        },
        toggleTheme: () => {
            const darkMode = !get().darkMode
            set({ darkMode })
            if (typeof window !== "undefined") {
                if (darkMode) {
                    document.documentElement.classList.add("dark")
                    setLocalStorage("theme", "dark")
                } else {
                    document.documentElement.classList.remove("dark")
                    setLocalStorage("theme", "light")
                }
            }
        },
        login: (user) => {
            set({ currentUser: user })
            setLocalStorage("juaafya_current_user", JSON.stringify(user))
            get().actions.fetchData()

            // Use RBAC to determine default view for role
            const defaultView = getDefaultViewForRole(user.role)
            set({ currentView: defaultView })

            get().actions.showToast(`Welcome back, ${user.name.split(" ")[0]}!`)
        },
        logout: async () => {
            try {
                await supabase.auth.signOut()
            } catch (e) {
                console.error("Supabase signout error:", e)
            }

            // Clear all localStorage items related to the app
            removeLocalStorage("juaafya_current_user")
            removeLocalStorage("juaafya_demo_user")
            removeLocalStorage("juaafya_settings")

            // Reset all state to initial values
            set({
                currentUser: null,
                currentView: "dashboard",
                isDemoMode: false,
                isAppLoading: false,
            })

            get().actions.showToast("You have been logged out.", "info")
        },
        switchUser: (user) => {
            set({ currentUser: user })
            setLocalStorage("juaafya_demo_user", JSON.stringify(user))

            // Use RBAC to determine default view for role
            const defaultView = getDefaultViewForRole(user.role)
            set({ currentView: defaultView })

            get().actions.showToast(`Switched to ${user.name} (${user.role})`)
        },
        showToast: (message, type = "success") => {
            const id = Date.now().toString()
            set((state) => ({ toasts: [...state.toasts, { id, message, type }] }))
            setTimeout(() => {
                set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
            }, 3000)
        },
    },
})

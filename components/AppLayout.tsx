"use client"

import React from "react"
import { useEffect, useState, useRef, useMemo, lazy, Suspense, useCallback } from "react"
import { Outlet, useNavigate, useLocation } from "react-router-dom"
import Sidebar from "./Sidebar"
const ChatBot = lazy(() => import("./ChatBot"))
import ErrorBoundary from "./ErrorBoundary"
import { CheckCircle, AlertCircle, X, WifiOff, Menu } from "lucide-react"
import { useEnterpriseAuth } from "../hooks/useEnterpriseAuth"
import useStore from "../store"
import { SYSTEM_ADMIN } from "../lib/config"
import { canAccessView } from "../lib/rbac"
import type { TeamMember, ViewState, Role } from "../types/index"
import { NEW_ROLE_MAP } from "../types/enterprise"
import logger from '../lib/logger'
import { Analytics } from "@vercel/analytics/react"
const ToastContainer = React.memo(({ toasts }: { toasts: any[] }) => {
    if (toasts.length === 0) return null;
    return (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 no-print">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-in slide-in-from-bottom-5 fade-in duration-300 ${toast.type === "success"
                        ? "bg-white dark:bg-slate-800 border-green-200 dark:border-green-900 text-green-700 dark:text-green-400"
                        : toast.type === "error"
                            ? "bg-white dark:bg-slate-800 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400"
                            : "bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-400"
                        }`}
                >
                    {toast.type === "success" ? (
                        <CheckCircle className="w-5 h-5" />
                    ) : toast.type === "error" ? (
                        <X className="w-5 h-5" />
                    ) : (
                        <AlertCircle className="w-5 h-5" />
                    )}
                    <span className="text-sm font-medium">{toast.message}</span>
                </div>
            ))}
        </div>
    );
});
ToastContainer.displayName = 'ToastContainer';

const AppLayout: React.FC = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const { user, teamMember, isLoading: authLoading, signOut: enterpriseSignOut, error: authError } = useEnterpriseAuth()
    const currentUser = useStore(state => state.currentUser);
    const toasts = useStore(state => state.toasts);
    const actions = useStore(state => state.actions);
    const team = useStore(state => state.settings.team);
    const inventory = useStore(state => state.inventory);

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const mobileMenuRef = useRef<HTMLDivElement>(null)

    // Track if we've ever successfully loaded a user - prevents spurious sign-out during init
    const hasLoadedUserRef = useRef(false)
    const lastSyncedUserId = useRef<string | null>(null)

    // Sync enterprise auth user to store and handle redirection
    useEffect(() => {
        if (authLoading) return

        if (user) {
            hasLoadedUserRef.current = true

            // Check if Super Admin and redirect immediately (before syncing to store)
            // This prevents Dashboard from rendering first and getting stuck
            // Check user.role directly - don't wait for teamMember
            const role = user.role?.toLowerCase().replace(" ", "_")
            if ((role === "superadmin" || role === "super_admin") && !location.pathname.startsWith("/sa-")) {
                logger.log("[AppLayout] Super Admin detected, redirecting immediately to sa-overview")
                navigate("/sa-overview", { replace: true })
                // Continue to sync - don't return early
            }

            // Sync to store if user changed or hasn't been synced yet
            // Wait for teamMember to be ready before syncing
            if (teamMember && (lastSyncedUserId.current !== user.id || !currentUser)) {
                logger.debug("[AppLayout] Syncing user to store:", teamMember.id)
                lastSyncedUserId.current = user.id
                actions.login(teamMember)
            }
        } else {
            // No user found
            if (currentUser && hasLoadedUserRef.current) {
                logger.log("[AppLayout] Session not found/expired - Clearing local store user")
                actions.clearAuth()
            }

            // Redirect to login if not on it
            if (location.pathname !== "/login") {
                logger.log("[AppLayout] No authenticated user, redirecting to login")
                navigate("/login", { replace: true })
            }
        }
    }, [user, authLoading, currentUser, teamMember, actions, location.pathname, navigate])

    // Close mobile menu when route changes
    useEffect(() => {
        setMobileMenuOpen(false)
    }, [location.pathname])

    // Close mobile menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
                setMobileMenuOpen(false)
            }
        }

        if (mobileMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [mobileMenuOpen])

    // Handle logout
    const handleLogout = async () => {
        await enterpriseSignOut()
        actions.logout()
        navigate("/login", { replace: true })
    }

    // Check view access based on current route
    const currentView = location.pathname.replace("/", "") || "dashboard"

    const handleViewChange = useCallback((view: string) => {
        const effectiveUser = currentUser || teamMember;
        const finalEffectiveUser = effectiveUser || (user ? {
            id: user.id,
            name: user.fullName,
            email: user.email,
            role: user.role || 'Doctor' as any,
            status: 'Active',
            lastActive: 'Now',
            avatar: user.avatarUrl || undefined,
            clinicId: user.clinicId || undefined,
        } : null) as TeamMember | null;
        if (finalEffectiveUser && canAccessView(finalEffectiveUser.role, view)) {
            navigate(`/${view}`)
        } else {
            actions.showToast("You don't have permission to access this page.", "error")
        }
    }, [currentUser, teamMember, user, navigate, actions])

    const lowStockCount = useMemo(() =>
        inventory.filter((i) => i.stock <= i.minStockLevel).length,
        [inventory])

    if (authError) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
                <div className="flex flex-col items-center max-w-md">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 w-full">
                        <h2 className="text-lg font-bold text-red-700 dark:text-red-400 mb-3">Authentication Configuration Error</h2>
                        <p className="text-sm text-red-600 dark:text-red-300 mb-4">{authError}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Please configure your Supabase credentials in environment variables and restart the server.
                        </p>
                        <a
                            href="https://www.builder.io/c/docs/projects"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-block text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                            View Setup Documentation →
                        </a>
                    </div>
                </div>
            </div>
        )
    }

    // Debug logging to understand the stuck state
    logger.debug("[AppLayout] Render check:", {
        authLoading,
        hasUser: !!user,
        hasTeamMember: !!teamMember,
        hasCurrentUser: !!currentUser,
        pathname: location.pathname,
        userId: user?.id
    })

    // Show loading only if we're still loading AND don't have a user yet
    // CRITICAL: Once we have a user, proceed immediately - don't wait for authLoading to clear
    // This prevents the stuck loading state where profile loads but component still shows loading
    if (authLoading && !user) {
        logger.debug("[AppLayout] Showing loading screen - authLoading true, no user")
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
                <div className="flex flex-col items-center max-w-md">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-slate-600 dark:text-slate-400 font-bold animate-pulse text-center">Establishing Secure Session...</p>
                </div>
            </div>
        )
    }

    // If we have a user, proceed immediately - don't wait for authLoading to clear
    // This fixes the stuck loading issue where profile loads but component is still waiting
    if (user) {
        logger.debug("[AppLayout] User exists, proceeding with render (authLoading may still be true)")
        // Continue to render logic below - don't block on authLoading
    }

    // If no user and not on login page, redirect (handled by useEffect)
    if (!user && location.pathname !== "/login") {
        logger.debug("[AppLayout] No user, returning null (will redirect)")
        return null // Will redirect via useEffect
    }

    // Get effective user - prefer currentUser from store (already synced), fallback to teamMember
    // teamMember is computed synchronously from user in the hook, so it should be available
    // If neither exists but user exists, create fallback immediately to prevent stuck loading
    const effectiveUser = currentUser || teamMember;

    logger.debug("[AppLayout] Effective user check:", {
        hasCurrentUser: !!currentUser,
        hasTeamMember: !!teamMember,
        hasEffectiveUser: !!effectiveUser,
        userRole: user?.role,
        teamMemberRole: teamMember?.role,
        userExists: !!user
    })

    // CRITICAL FIX: If user exists, create finalUser immediately - don't wait or show loading
    // This prevents the stuck loading state where profile loads but component blocks
    const finalUser = effectiveUser || (user ? {
        id: user.id,
        name: user.fullName,
        email: user.email,
        role: (user.role as Role) || 'Doctor',
        status: (user.status as "Active" | "Invited" | "Deactivated") || 'Active',
        lastActive: 'Now',
        avatar: user.avatarUrl || undefined,
        clinicId: user.clinicId || undefined,
    } : null)

    if (!finalUser) {
        logger.error("[AppLayout] No user data available at all - this should not happen")
        return null
    }

    logger.debug("[AppLayout] Rendering app with user:", finalUser.name, finalUser.role, "from:", effectiveUser ? "effectiveUser" : "fallback")

    return (
        <ErrorBoundary>
            <Analytics />
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex transition-colors duration-200 font-sans">
                <Sidebar
                    ref={mobileMenuRef}
                    currentView={currentView as ViewState}
                    setView={handleViewChange}
                    lowStockCount={lowStockCount}
                    currentUser={finalUser}
                    switchUser={actions.switchUser}
                    team={team}
                    systemAdmin={SYSTEM_ADMIN}
                    onLogout={handleLogout}
                    mobileMenuOpen={mobileMenuOpen}
                    setMobileMenuOpen={setMobileMenuOpen}
                />

                <main className="flex-1 md:ml-72 lg:ml-80 w-full transition-all duration-300 min-h-screen flex flex-col">
                    <div className="md:hidden bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-3 sm:p-4 sticky top-0 z-50 flex items-center justify-between no-print">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <button
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="p-2 -ml-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors active:scale-95"
                                aria-label="Toggle navigation menu"
                            >
                                <Menu className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                            </button>
                            <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center">
                                <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                                    <path
                                        d="M12 2V4M12 20V22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M2 12H4M20 12H22M6.34 17.66L4.93 19.07M19.07 4.93L17.66 6.34"
                                        stroke="#EFE347"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                    />
                                    <circle cx="12" cy="12" r="6" fill="#3462EE" />
                                    <path d="M12 9V15M9 12H15" stroke="white" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </div>
                            <h1 className="font-bold text-lg sm:text-xl text-slate-800 dark:text-white tracking-tight">JuaAfya</h1>
                        </div>
                        {finalUser && (
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-md">
                                {finalUser.name.substring(0, 2).toUpperCase()}
                            </div>
                        )}
                    </div>

                    <Outlet />
                </main>

                <div className="no-print">
                    <Suspense fallback={null}>
                        <ChatBot />
                    </Suspense>
                </div>

                {/* Toast notifications */}
                <ToastContainer toasts={toasts} />
            </div>
        </ErrorBoundary>
    )
}

export default AppLayout

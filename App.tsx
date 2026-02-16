import React, { useEffect, Suspense, lazy } from "react"
import type { AuthChangeEvent, Session } from "@supabase/supabase-js"
import { Analytics } from "@vercel/analytics/react"
import Sidebar from "./components/Sidebar"
import ErrorBoundary from "./components/ErrorBoundary"
import type { TeamMember } from "./types/index"
import { CheckCircle, AlertCircle, X } from "lucide-react"
import { supabase } from "./lib/supabaseClient"
import useStore from "./store"
import { SYSTEM_ADMIN } from "./lib/config"
import { canAccessView, isSuperAdmin as checkIsSuperAdmin } from "./lib/rbac"
import { getSupabaseConfigStatus } from "./lib/supabase/config-check"
import { useEnterpriseAuth } from "./hooks/useEnterpriseAuth"
import PendingApproval from "./components/PendingApproval"

// Lazy load components to reduce initial bundle size
const Dashboard = lazy(() => import("./components/Dashboard"))

// Guard Rail: Check if clinic is pending approval removed from here (it belongs inside the component)
const PatientList = lazy(() => import("./components/PatientList"))
const Appointments = lazy(() => import("./components/Appointments"))
const Pharmacy = lazy(() => import("./components/Pharmacy"))
const Reports = lazy(() => import("./components/Reports"))
const Settings = lazy(() => import("./components/Settings"))
const Profile = lazy(() => import("./components/Profile"))
const ChatBot = lazy(() => import("./components/ChatBot"))
const BulkSMS = lazy(() => import("./components/BulkSMS"))
const PatientQueue = lazy(() => import("./components/PatientQueue"))
const SuperAdminDashboard = lazy(() => import("./components/SuperAdminDashboard"))
const WhatsAppAgent = lazy(() => import("./components/WhatsAppAgent"))
const HelpDesk = lazy(() => import("./components/HelpDesk"))
const Login = lazy(() => import("./components/Login"))

const App: React.FC = () => {
    // Granular selectors: components only re-render when the specific data they use changes.
    const currentView = useStore(state => state.currentView)
    const isAppLoading = useStore(state => state.isAppLoading)
    const darkMode = useStore(state => state.darkMode)
    const patients = useStore(state => state.patients)
    const appointments = useStore(state => state.appointments)
    const inventory = useStore(state => state.inventory)
    const suppliers = useStore(state => state.suppliers)
    const inventoryLogs = useStore(state => state.inventoryLogs)
    const visits = useStore(state => state.visits)
    const labTests = useStore(state => state.labTests)
    const settings = useStore(state => state.settings)
    const currentUser = useStore(state => state.currentUser)
    const toasts = useStore(state => state.toasts)
    const actions = useStore(state => state.actions)

    // REMOVED: Duplicate auth logic
    // Authentication is now handled by:
    // 1. useEnterpriseAuth hook - manages auth state and user data
    // 2. AppLayout component - syncs user to store and handles routing
    // This prevents race conditions and duplicate state updates
    //
    // Note: App.tsx may still be used for legacy routing, but auth should be handled by the router/AppLayout

    // Fail fast: if Supabase is not configured, render an instruction screen instead of running in demo mode.
    const supabaseStatus = getSupabaseConfigStatus()
    if (!supabaseStatus.isConfigured) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="max-w-xl bg-red-50 p-6 rounded-lg border border-red-200">
                    <h2 className="text-xl font-bold text-red-700">Supabase Not Configured</h2>
                    <p className="mt-2 text-sm text-red-600">This build requires Supabase configuration to run. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your environment and rebuild.</p>
                    <p className="mt-4 text-xs text-slate-500">See <code>SUPABASE_SETUP.md</code> for details.</p>
                </div>
            </div>
        )
    }

    const lowStockCount = inventory.filter((i) => i.stock <= i.minStockLevel).length

    const handleViewChange = (view: string) => {
        if (currentUser && canAccessView(currentUser.role, view)) {
            actions.setCurrentView(view)
        } else {
            actions.showToast("You don't have permission to access this page.", "error")
        }
    }

    const renderContent = () => {
        if (!currentUser) return null

        const queueProps = {
            visits,
            patients,
            inventory,
            labTests,
            addVisit: actions.addVisit,
            updateVisit: actions.updateVisit,
            onCompleteVisit: actions.completeVisit,
        }

        switch (currentView) {
            case "dashboard":
                return <Dashboard />
            case "reception":
                return <PatientQueue {...queueProps} restrictedStages={["Check-In", "Clearance"]} />
            case "triage":
                return <PatientQueue {...queueProps} restrictedStages={["Vitals"]} />
            case "consultation":
                return <PatientQueue {...queueProps} restrictedStages={["Consultation"]} />
            case "lab-work":
                return <PatientQueue {...queueProps} restrictedStages={["Lab"]} />
            case "billing-desk":
                return <PatientQueue {...queueProps} restrictedStages={["Billing"]} />
            case "helpdesk":
                return <HelpDesk />
            case "sa-overview":
            case "sa-clinics":
            case "sa-approvals":
            case "sa-payments":
            case "sa-settings":
            case "sa-support":
                const tab = currentView.replace("sa-", "") as any
                return (
                    <SuperAdminDashboard
                        currentUser={currentUser}
                        team={settings.team}
                        activeTab={tab}
                        onLogout={actions.logout}
                        switchUser={actions.switchUser}
                    />
                )
            case "patients":
                return (
                    <PatientList
                        patients={patients}
                        addPatient={actions.addPatient}
                        updatePatient={actions.updatePatient}
                        deletePatient={actions.deletePatient}
                        settings={settings}
                    />
                )
            case "appointments":
                return (
                    <Appointments
                        appointments={appointments}
                        patients={patients}
                        addAppointment={actions.addAppointment}
                        updateAppointment={actions.updateAppointment}
                        showToast={actions.showToast}
                    />
                )
            case "pharmacy":
                return (
                    <Pharmacy
                        inventory={inventory}
                        suppliers={suppliers}
                        logs={inventoryLogs}
                        visits={visits}
                        onDispense={actions.dispensePrescription}
                        addInventoryItem={actions.addInventoryItem}
                        updateInventoryItem={actions.updateInventoryItem}
                        deleteInventoryItem={actions.deleteInventoryItem}
                        addSupplier={actions.addSupplier}
                        updateSupplier={actions.updateSupplier}
                        deleteSupplier={actions.deleteSupplier}
                    />
                )
            case "bulk-sms":
                return <BulkSMS patients={patients} showToast={actions.showToast} settings={settings} />
            case "whatsapp-agent":
                return (
                    <WhatsAppAgent
                        team={settings.team}
                        appointments={appointments}
                        inventory={inventory}
                        patients={patients}
                        settings={settings}
                        addPatient={actions.addPatient}
                        updatePatient={actions.updatePatient}
                        deletePatient={actions.deletePatient}
                        addAppointment={actions.addAppointment}
                        updateAppointment={actions.updateAppointment}
                        updateInventoryItem={actions.updateInventoryItem}
                        deleteInventoryItem={actions.deleteInventoryItem}
                        updateSettings={actions.updateSettings}
                    />
                )
            case "reports":
                return <Reports />
            case "settings":
                return (
                    <Settings
                        isDarkMode={darkMode}
                        toggleTheme={actions.toggleTheme}
                        settings={settings}
                        updateSettings={actions.updateSettings}
                        showToast={actions.showToast}
                    />
                )
            case "profile":
                return <Profile />
            default:
                return <PatientQueue {...queueProps} />
        }
    }

    if (isAppLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-brand-cream/50 dark:bg-brand-dark">
                <div className="flex flex-col items-center">
                    <div className="w-16 h-16 border-4 border-brand-blue border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-brand-dark dark:text-white font-bold animate-pulse">Initializing JuaAfya Cloud...</p>
                </div>
            </div>
        )
    }

    const { organization, refresh: refreshAuth } = useEnterpriseAuth()

    if (!currentUser) {
        return (
            <>
                <Login onLogin={actions.login} />
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 no-print">
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
            </>
        )
    }

    // Guard Rail: Check if clinic is pending approval
    // We check organization directly from useEnterpriseAuth because it might not be in the store yet
    // Database stores status as lowercase 'pending', so check case-insensitively
    const orgStatus = organization?.status?.toLowerCase() || '';
    const isSuperAdmin = checkIsSuperAdmin(currentUser?.role);
    if (organization && orgStatus === 'pending' && !isSuperAdmin) {
        return <PendingApproval clinicName={organization.name} onLogout={actions.logout} />
    }

    return (
        <ErrorBoundary>
            <Analytics />
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col md:flex-row transition-colors duration-200 font-sans">
                <Sidebar
                    currentView={currentView as any}
                    setView={handleViewChange}
                    lowStockCount={lowStockCount}
                    currentUser={currentUser}
                    switchUser={actions.switchUser}
                    team={settings.team}
                    systemAdmin={SYSTEM_ADMIN}
                    onLogout={actions.logout}
                />

                <main className="flex-1 w-full md:ml-64 lg:ml-72 transition-all duration-300 px-4 sm:px-5 md:px-6 lg:px-8">
                    <div className="md:hidden bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 sm:p-5 sticky top-0 z-10 flex items-center justify-between no-print">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
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
                            <h1 className="font-bold text-base sm:text-lg text-slate-800 dark:text-white truncate">JuaAfya</h1>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-xs flex-shrink-0">
                            {currentUser.name.substring(0, 2)}
                        </div>
                    </div>

                    <Suspense fallback={
                        <div className="h-full flex items-center justify-center">
                            <div className="w-10 h-10 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    }>
                        {renderContent()}
                    </Suspense>
                </main>

                <div className="no-print">
                    <ChatBot />
                </div>

                <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 no-print max-w-[calc(100%-2rem)] px-2">
                    {toasts.map((toast) => (
                        <div
                            key={toast.id}
                            className={`flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl shadow-lg border animate-in slide-in-from-bottom-5 fade-in duration-300 text-xs sm:text-sm ${toast.type === "success"
                                ? "bg-white dark:bg-slate-800 border-green-200 dark:border-green-900 text-green-700 dark:text-green-400"
                                : toast.type === "error"
                                    ? "bg-white dark:bg-slate-800 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400"
                                    : "bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-400"
                                }`}
                        >
                            {toast.type === "success" ? (
                                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                            ) : toast.type === "error" ? (
                                <X className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                            ) : (
                                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                            )}
                            <span className="font-medium line-clamp-2">{toast.message}</span>
                        </div>
                    ))}
                </div>
            </div>
        </ErrorBoundary>
    )
}

export default App

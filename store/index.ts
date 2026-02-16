import { create } from "zustand"
import type {
    Patient,
    Appointment,
    InventoryItem,
    ClinicSettings,
    Notification,
    Supplier,
    InventoryLog,
    Visit,
    TeamMember,
} from "../types"
// Note: demo/mock constants removed for production readiness. Ensure Supabase is configured.
import { db } from "../services/db"
import { teamService } from "../services/teamService"

// Re-export slices for direct usage if needed
export * from "./patientSlice"
export * from "./inventorySlice"
export * from "./visitSlice"
export * from "./appointmentSlice"
export * from "./authSlice"
export * from "./settingsSlice"

// Combined store interface
export interface AppState {
    // Auth & UI State
    currentView: string
    isAppLoading: boolean
    isDemoMode: boolean
    darkMode: boolean
    currentUser: TeamMember | null
    toasts: Notification[]

    // Domain Data
    patients: Patient[]
    appointments: Appointment[]
    inventory: InventoryItem[]
    suppliers: Supplier[]
    inventoryLogs: InventoryLog[]
    labTests: import('../types').LabTestProfile[]
    visits: Visit[]
    settings: ClinicSettings

    // Actions grouped by domain
    actions: {
        // UI Actions
        setCurrentView: (view: string) => void
        setIsAppLoading: (isLoading: boolean) => void
        setIsDemoMode: (isDemo: boolean) => void
        toggleTheme: () => void
        showToast: (message: string, type?: "success" | "error" | "info") => void

        // Auth Actions
        login: (user: TeamMember) => void
        clearAuth: () => void
        logout: () => Promise<void>
        switchUser: (user: TeamMember) => void
        updateCurrentUser: (updates: Partial<TeamMember>) => void

        // Data Actions
        fetchData: () => Promise<void>

        // Patient Actions
        addPatient: (patient: Patient) => Promise<void>
        updatePatient: (patient: Patient) => Promise<void>
        deletePatient: (id: string) => Promise<void>

        // Inventory Actions
        addInventoryItem: (item: InventoryItem) => Promise<void>
        updateInventoryItem: (item: InventoryItem, reason?: string) => Promise<void>
        deleteInventoryItem: (id: string) => Promise<void>
        addSupplier: (supplier: Supplier) => Promise<void>
        updateSupplier: (supplier: Supplier) => Promise<void>
        deleteSupplier: (id: string) => Promise<void>
        createInventoryLog: (log: Omit<InventoryLog, 'id' | 'timestamp'>) => Promise<void>

        // Appointment Actions
        addAppointment: (appointment: Appointment) => Promise<void>
        updateAppointment: (appointment: Appointment) => Promise<void>
        deleteAppointment: (appointmentId: string) => Promise<void>
        checkInAppointment: (appointment: Appointment) => Promise<void>

        // Visit Actions
        addVisit: (patientId: string, priority?: string, insurance?: any, skipVitals?: boolean) => Promise<void>
        updateVisit: (visit: Visit) => Promise<void>
        dispensePrescription: (visit: Visit) => Promise<void>
        completeVisit: (visit: Visit) => Promise<void>

        // Settings Actions
        updateSettings: (settings: ClinicSettings) => Promise<void>
    }
}

// Helper functions
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

// Import default settings
import { createSettingsSlice } from "./settingsSlice"
import { getDefaultViewForRole } from "../lib/rbac"
import { supabase } from "../lib/supabaseClient"
import logger from '../lib/logger'

// Deduplication: prevent parallel fetchData calls
let fetchDataInFlight: Promise<void> | null = null
let lastFetchDataTimestamp = 0
const FETCH_DATA_THROTTLE_MS = 30_000 // Don't re-fetch within 30 seconds

// Default settings (duplicated here for the store, but could be imported)
const defaultSettings: ClinicSettings = {
    name: "My Clinic",
    phone: "",
    email: "",
    location: "Not Set",
    currency: "KSh",
    language: "English",
    timezone: "EAT (GMT+3)",
    smsEnabled: false,
    logo: "",
    smsConfig: { apiKey: "", senderId: "JUAAFYA" },
    paymentConfig: {
        provider: "None",
        apiKey: "",
        secretKey: "",
        webhookUrl: "",
        webhookSecret: "",
        testMode: true,
        isConfigured: false,
    },
    notifications: {
        appointmentReminders: true,
        lowStockAlerts: true,
        dailyReports: false,
        marketingEmails: false,
        alertEmail: "",
    },
    security: { twoFactorEnabled: false, lastPasswordChange: new Date().toISOString().split('T')[0] },
    billing: {
        plan: "Free",
        status: "Active",
        nextBillingDate: "N/A",
        paymentMethod: { type: "M-Pesa", last4: "0000", brand: "M-Pesa", expiry: "N/A" },
    },
    team: [], // Team members loaded from Supabase users table
}

// Initial settings should come from DB. We only use defaultSettings as a temporary placeholder.
const getInitialSettings = (): ClinicSettings => defaultSettings;

// Create the combined store
const ALLOW_DEMO = import.meta.env.VITE_ALLOW_DEMO_MODE === "true"

const useStore = create<AppState>((set, get) => ({
    // Initial State
    currentView: getLocalStorage("juaafya_current_view") || "dashboard",
    isAppLoading: true,
    isDemoMode: false, // Strictly disabled unless explicitly set by Supabase config in Auth sync
    darkMode: getLocalStorage("theme") === "dark",
    currentUser: null,
    toasts: [],
    patients: [],
    appointments: [],
    inventory: [],
    suppliers: [],
    inventoryLogs: [],
    labTests: [],
    visits: [],
    settings: defaultSettings, // Initial state, will be updated by fetchData from Supabase

    actions: {
        // UI Actions
        setCurrentView: (view) => {
            set({ currentView: view })
            setLocalStorage("juaafya_current_view", view)
        },
        setIsAppLoading: (isLoading) => set({ isAppLoading: isLoading }),
        setIsDemoMode: (isDemo) => {
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
        showToast: (message, type = "success") => {
            const id = Date.now().toString()
            set((state) => ({ toasts: [...state.toasts, { id, message, type }] }))
            setTimeout(() => {
                set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
            }, 3000)
        },

        // Auth Actions
        login: (user) => {
            const current = get().currentUser
            // Pre-check to avoid redundant state updates and fetches if same user
            if (current && current.id === user.id && current.role === user.role) {
                return
            }

            set({ currentUser: user })
            setLocalStorage("juaafya_current_user", JSON.stringify(user))
            get().actions.fetchData()
            const defaultView = getDefaultViewForRole(user.role)
            set({ currentView: defaultView })
            get().actions.showToast(`Welcome back, ${user.name.split(" ")[0]}!`)
        },
        clearAuth: () => {
            removeLocalStorage("juaafya_current_user")
            removeLocalStorage("juaafya_demo_user")
            set({
                currentUser: null,
                patients: [],
                appointments: [],
                inventory: [],
                visits: [],
                suppliers: [],
                inventoryLogs: [],
                isDemoMode: false,
                isAppLoading: false,
            })
        },
        logout: async () => {
            try {
                await supabase.auth.signOut()
            } catch (e) {
                console.error("Supabase signout error:", e)
            }
            get().actions.clearAuth()
            removeLocalStorage("juaafya_settings")
            set({ currentView: "dashboard" })
            get().actions.showToast("You have been logged out.", "info")
        },
        switchUser: (user) => {
            set({ currentUser: user })
            setLocalStorage("juaafya_demo_user", JSON.stringify(user))
            const defaultView = getDefaultViewForRole(user.role)
            set({ currentView: defaultView })
            get().actions.showToast(`Switched to ${user.name} (${user.role})`)
        },
        // Update the current user in-store and persist to localStorage without changing view
        updateCurrentUser: (updates: Partial<TeamMember>) => {
            const current = get().currentUser
            if (!current) return
            const updated = { ...current, ...updates }
            set({ currentUser: updated })
            setLocalStorage("juaafya_current_user", JSON.stringify(updated))
        },

        // Data Actions
        fetchData: async () => {
            const currentUser = get().currentUser
            if (!currentUser) return

            // Optimization: Super Admins don't need clinic-specific operational data loaded globally
            if (currentUser.role === 'SuperAdmin') {
                set({ isAppLoading: false })
                return
            }

            // Throttle: skip if we just fetched recently
            const now = Date.now()
            if (now - lastFetchDataTimestamp < FETCH_DATA_THROTTLE_MS && !get().isAppLoading) {
                logger.debug('[Store] fetchData throttled — last fetch was', now - lastFetchDataTimestamp, 'ms ago')
                return
            }

            // Dedup: reuse in-flight fetch if one is already running
            if (fetchDataInFlight) {
                logger.debug('[Store] fetchData already in flight, reusing...')
                return fetchDataInFlight
            }

            const doFetch = async () => {
                try {
                    const [patients, inventory, appointments, visits, suppliers, settings, team, inventoryLogs] = await Promise.all([
                        db.getPatients(),
                        db.getInventory(),
                        db.getAppointments(),
                        db.getVisits(),
                        db.getSuppliers(),
                        db.getSettings(),
                        teamService.getTeamMembers(),
                        db.getInventoryLogs(),
                    ])

                    set({
                        patients,
                        inventory,
                        appointments,
                        visits,
                        suppliers,
                        inventoryLogs,
                        settings: { ...(settings || get().settings), team: team || [] },
                        isAppLoading: false,
                    })
                    lastFetchDataTimestamp = Date.now()

                    // Non-blocking: load lab tests in background (only needed in PatientQueue)
                    db.getLabTests().then(labTests => {
                        set({ labTests: labTests || [] })
                    }).catch(() => {
                        // Lab tests are non-critical, silently ignore fetch failure
                    })
                } catch (e) {
                    console.error("Data fetch failed:", e)
                    get().actions.showToast("Error fetching initial data: check backend logs.", "error")
                } finally {
                    set({ isAppLoading: false })
                    fetchDataInFlight = null
                }
            }

            fetchDataInFlight = doFetch()
            return fetchDataInFlight
        },

        // Patient Actions
        addPatient: async (patient) => {
            try {
                const saved = await db.createPatient(patient)
                if (!saved) throw new Error('Failed to create patient')
                set((state) => ({ patients: [saved, ...state.patients] }))
                get().actions.showToast(`Patient ${saved.name} added successfully!`)
            } catch (e) {
                console.error('addPatient error', e)
                get().actions.showToast("Error adding patient to database.", "error")
            }
        },
        updatePatient: async (updatedPatient) => {
            try {
                await db.updatePatient(updatedPatient)
                set((state) => ({
                    patients: state.patients.map((p) => (p.id === updatedPatient.id ? updatedPatient : p)),
                }))
                get().actions.showToast(`Patient record updated.`)
            } catch (e) {
                console.error('updatePatient error', e)
                get().actions.showToast("Error updating patient", "error")
            }
        },
        deletePatient: async (id) => {
            try {
                await db.deletePatient(id)
                set((state) => ({ patients: state.patients.filter((p) => p.id !== id) }))
                get().actions.showToast(`Patient deleted.`, "info")
            } catch (e) {
                console.error('deletePatient error', e)
                get().actions.showToast("Error deleting patient", "error")
            }
        },

        // Inventory Actions
        addInventoryItem: async (item) => {
            try {
                const saved = await db.createInventoryItem(item)
                if (!saved) throw new Error('Failed to create inventory item')
                set((state) => ({ inventory: [saved, ...state.inventory] }))

                // Log the action
                get().actions.createInventoryLog({
                    itemId: saved.id,
                    itemName: saved.name,
                    action: "Created",
                    quantityChange: saved.stock,
                    notes: "Initial stock entry",
                    user: get().currentUser?.name || "System"
                })

                get().actions.showToast(`${saved.name} added to inventory.`)
            } catch (e) {
                console.error('addInventoryItem error', e)
                get().actions.showToast("Error creating item", "error")
            }
        },
        updateInventoryItem: async (updatedItem, reason = "Updated details") => {
            try {
                const oldItem = get().inventory.find(i => i.id === updatedItem.id)
                await db.updateInventoryItem(updatedItem)
                set((state) => ({
                    inventory: state.inventory.map((i) => (i.id === updatedItem.id ? updatedItem : i)),
                }))

                // Log the action if stock changed or specific reason provided
                const stockChange = oldItem ? updatedItem.stock - oldItem.stock : 0
                get().actions.createInventoryLog({
                    itemId: updatedItem.id,
                    itemName: updatedItem.name,
                    action: stockChange > 0 ? "Restocked" : "Updated",
                    quantityChange: stockChange,
                    notes: reason,
                    user: get().currentUser?.name || "System"
                })

                get().actions.showToast(`${updatedItem.name} updated.`)
            } catch (e) {
                console.error('updateInventoryItem error', e)
                get().actions.showToast("Error updating item", "error")
            }
        },
        deleteInventoryItem: async (id) => {
            try {
                const item = get().inventory.find(i => i.id === id)
                await db.deleteInventoryItem(id)
                set((state) => ({ inventory: state.inventory.filter((i) => i.id !== id) }))

                if (item) {
                    get().actions.createInventoryLog({
                        itemId: id,
                        itemName: item.name,
                        action: "Deleted",
                        notes: "Item deleted from catalog",
                        user: get().currentUser?.name || "System"
                    })
                }

                get().actions.showToast(`Item removed.`, "info")
            } catch (e) {
                console.error('deleteInventoryItem error', e)
                get().actions.showToast("Error deleting item", "error")
            }
        },
        addSupplier: async (supplier) => {
            try {
                const saved = await db.createSupplier(supplier)
                const newSupplier = saved || supplier
                set((state) => ({ suppliers: [...state.suppliers, newSupplier] }))
                get().actions.showToast("Supplier added successfully.")
            } catch (e) {
                console.error('addSupplier error', e)
                get().actions.showToast("Error adding supplier", "error")
            }
        },
        updateSupplier: async (updated) => {
            try {
                await db.updateSupplier(updated)
                set((state) => ({
                    suppliers: state.suppliers.map((s) => (s.id === updated.id ? updated : s)),
                }))
                get().actions.showToast("Supplier updated.")
            } catch (e) {
                console.error('updateSupplier error', e)
                get().actions.showToast("Error updating supplier", "error")
            }
        },
        deleteSupplier: async (id) => {
            try {
                await db.deleteSupplier(id)
                set((state) => ({ suppliers: state.suppliers.filter((s) => s.id !== id) }))
                set((state) => ({
                    inventory: state.inventory.map((item) =>
                        item.supplierId === id ? { ...item, supplierId: undefined } : item,
                    ),
                }))
                get().actions.showToast("Supplier removed.", "info")
            } catch (e) {
                console.error('deleteSupplier error', e)
                get().actions.showToast("Error deleting supplier", "error")
            }
        },
        createInventoryLog: async (logData) => {
            try {
                const savedLog = await db.createInventoryLog(logData)
                set((state) => ({ inventoryLogs: [savedLog, ...state.inventoryLogs] }))
            } catch (e) {
                console.error('createInventoryLog error', e)
                // Don't show toast for logging errors unless critical
            }
        },

        // Appointment Actions
        addAppointment: async (newAppt) => {
            try {
                let createdAppt = newAppt
                const savedAppt = await db.createAppointment(newAppt)
                if (savedAppt) createdAppt = savedAppt
                set((state) => ({ appointments: [...state.appointments, createdAppt] }))
                get().actions.showToast(`Appointment scheduled for ${createdAppt.patientName}.`)
            } catch (e) {
                get().actions.showToast("Error scheduling appointment", "error")
            }
        },
        updateAppointment: async (updatedAppt) => {
            try {
                await db.updateAppointment(updatedAppt)
                set((state) => ({
                    appointments: state.appointments.map((a) => (a.id === updatedAppt.id ? updatedAppt : a)),
                }))
            } catch (e) {
                get().actions.showToast("Error updating appointment", "error")
            }
        },
        deleteAppointment: async (appointmentId) => {
            try {
                await db.deleteAppointment(appointmentId)
                set((state) => ({ appointments: state.appointments.filter((a) => a.id !== appointmentId) }))
                get().actions.showToast("Appointment deleted.", "info")
            } catch (e) {
                console.error('deleteAppointment error', e)
                get().actions.showToast("Error deleting appointment", "error")
            }
        },
        checkInAppointment: async (appointment: Appointment) => {
            try {
                await get().actions.addVisit(appointment.patientId, "Normal")
                await get().actions.updateAppointment({ ...appointment, status: "Completed" })
            } catch (e) {
                console.error('checkInAppointment error', e)
                get().actions.showToast("Error checking in appointment", "error")
            }
        },

        // Visit Actions
        addVisit: async (patientId, priority = "Normal", insurance, skipVitals = false) => {
            const patient = get().patients.find((p) => p.id === patientId)
            if (!patient) return

            const newVisit: Visit = {
                id: `V${Date.now()}`,
                patientId: patient.id,
                patientName: patient.name,
                stage: skipVitals ? "Consultation" : "Vitals",
                stageStartTime: new Date().toISOString(),
                startTime: new Date().toISOString(),
                queueNumber: get().visits.filter((v) => v.stage !== "Completed").length + 1,
                priority: priority as any,
                labOrders: [],
                prescription: [],
                medicationsDispensed: false,
                consultationFee: 500,
                totalBill: 500,
                paymentStatus: "Pending",
                vitals: { bp: "", heartRate: "", temp: "", weight: "", height: "", respRate: "", spo2: "" },
            }

            try {
                let createdVisit = newVisit
                const saved = await db.createVisit(newVisit)
                if (saved) createdVisit = saved
                set((state) => ({ visits: [...state.visits, createdVisit] }))
                get().actions.showToast(`${patient.name} checked in.`)
            } catch (e) {
                get().actions.showToast("Error checking in patient", "error")
            }
        },
        updateVisit: async (updatedVisit) => {
            try {
                await db.updateVisit(updatedVisit)
                set((state) => ({
                    visits: state.visits.map((v) => (v.id === updatedVisit.id ? updatedVisit : v)),
                }))
            } catch (e) {
                get().actions.showToast("Error updating visit", "error")
            }
        },
        dispensePrescription: async (visit) => {
            const updatedInventory = [...get().inventory]
            for (const med of visit.prescription) {
                const itemIndex = updatedInventory.findIndex((i) => i.id === med.inventoryId)
                if (itemIndex > -1) {
                    const item = updatedInventory[itemIndex]
                    const newStock = Math.max(0, item.stock - med.quantity)
                    updatedInventory[itemIndex] = { ...item, stock: newStock }
                    try {
                        await db.updateInventoryItem(updatedInventory[itemIndex])

                        // Log the action
                        get().actions.createInventoryLog({
                            itemId: item.id,
                            itemName: item.name,
                            action: "Dispensed",
                            quantityChange: -med.quantity,
                            notes: `Dispensed to ${visit.patientName} (Visit ${visit.id})`,
                            user: get().currentUser?.name || "System"
                        })
                    } catch (err) {
                        console.error('Failed to update inventory during dispensePrescription', err)
                    }
                }
            }
            set({ inventory: updatedInventory })

            const nextVisitState: Visit = {
                ...visit,
                medicationsDispensed: true,
                stage: "Clearance",
                stageStartTime: new Date().toISOString(),
            }
            await get().actions.updateVisit(nextVisitState)
            get().actions.showToast("Medications dispensed. Sent to Clearance.")
        },
        completeVisit: async (visit) => {
            // Build a professional clinical summary
            const diagnosisText = visit.diagnosis ? `Diagnosis: ${visit.diagnosis}` : "Diagnostic assessment pending"
            const vitalsText = visit.vitals
                ? `Vitals: BP ${visit.vitals.bp || '--'}, Temp ${visit.vitals.temp || '--'}°C, BMI ${(() => {
                    const w = parseFloat(visit.vitals.weight || "0");
                    const h = parseFloat(visit.vitals.height || "0") / 100;
                    return (w > 0 && h > 0) ? (w / (h * h)).toFixed(1) : '--';
                })()}`
                : "";

            const labsText = visit.labOrders.length > 0
                ? `Labs: ${visit.labOrders.map(lo => `${lo.testName}=${lo.result || 'Pending'}${lo.flag && lo.flag !== 'Normal' ? ` (${lo.flag})` : ''}`).join(', ')}`
                : "";

            const notesText = visit.doctorNotes ? `Dr Notes: ${visit.doctorNotes}` : "";

            const summary = `[${visit.startTime.split("T")[0]}] ${diagnosisText}. ${vitalsText}. ${labsText}. ${notesText}`.replace(/\.\s\./g, '.').trim();

            const patient = get().patients.find((p) => p.id === visit.patientId)
            if (patient) {
                const updatedPatient = {
                    ...patient,
                    lastVisit: new Date().toISOString().split("T")[0],
                    history: [summary, ...patient.history],
                }
                await get().actions.updatePatient(updatedPatient)
            }

            await get().actions.updateVisit({ ...visit, stage: "Completed" })
            get().actions.showToast("Visit finalized and patient history updated.", "success")
        },

        // Settings Actions
        updateSettings: async (newSettings) => {
            set({ settings: newSettings })

            try {
                await db.updateSettings(newSettings, get().currentUser?.clinicId)
                get().actions.showToast("Settings saved successfully!")
            } catch (e) {
                console.error("Failed to save settings to DB", e)
                get().actions.showToast("Settings saved locally (DB Error)", "info")
            }
        },
    },
}))

export default useStore

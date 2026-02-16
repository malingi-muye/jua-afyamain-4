import type { StateCreator } from "zustand"
import type { ClinicSettings } from "../types"

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

const defaultSettings: ClinicSettings = {
    name: "JuaAfya Medical Centre",
    phone: "+254 712 345 678",
    email: "admin@juaafya.com",
    location: "Nairobi, Kenya",
    currency: "KSh",
    language: "English",
    timezone: "EAT (GMT+3)",
    smsEnabled: true,
    logo: "",
    smsConfig: {
        apiKey: "",
        senderId: "MOBIWAVE",
    },
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
        alertEmail: "admin@juaafya.com",
    },
    security: {
        twoFactorEnabled: false,
        lastPasswordChange: "2023-09-15",
    },
    billing: {
        plan: "Pro",
        status: "Active",
        nextBillingDate: "2023-11-01",
        paymentMethod: {
            type: "Card",
            last4: "4242",
            brand: "Visa",
            expiry: "12/25",
        },
    },
    team: [
        {
            id: "1",
            name: "Dr. Andrew Kimani",
            email: "andrew@juaafya.com",
            phone: "+254712345678",
            role: "Admin",
            status: "Active",
            lastActive: "Now",
            avatar: "https://i.pravatar.cc/150?img=11",
        },
        {
            id: "2",
            name: "Sarah Wanjiku",
            email: "sarah@juaafya.com",
            phone: "+254722987654",
            role: "Nurse",
            status: "Active",
            lastActive: "2h ago",
            avatar: "https://i.pravatar.cc/150?img=5",
        },
        {
            id: "3",
            name: "John Omondi",
            email: "john@juaafya.com",
            phone: "+254733111222",
            role: "Doctor",
            status: "Active",
            lastActive: "5m ago",
            avatar: "https://i.pravatar.cc/150?img=12",
        },
        {
            id: "4",
            name: "Grace M.",
            email: "grace@juaafya.com",
            phone: "+254700123456",
            role: "Receptionist",
            status: "Active",
            lastActive: "Now",
            avatar: "https://i.pravatar.cc/150?img=9",
        },
        {
            id: "5",
            name: "Peter K.",
            email: "peter@juaafya.com",
            phone: "+254799888777",
            role: "Lab Tech",
            status: "Active",
            lastActive: "10m ago",
            avatar: "https://i.pravatar.cc/150?img=8",
        },
    ],
}

const getInitialSettings = (): ClinicSettings => {
    const saved = getLocalStorage("juaafya_settings")
    if (saved) {
        try {
            const parsed = JSON.parse(saved)
            return { ...defaultSettings, ...parsed }
        } catch (e) {
            return defaultSettings
        }
    }
    return defaultSettings
}

export interface SettingsSlice {
    settings: ClinicSettings
    actions: {
        updateSettings: (settings: ClinicSettings) => void
    }
}

export const createSettingsSlice: StateCreator<
    SettingsSlice & { actions: { showToast: (msg: string, type?: "success" | "error" | "info") => void } },
    [],
    [],
    SettingsSlice
> = (set, get) => ({
    settings: getInitialSettings(),
    actions: {
        updateSettings: (newSettings) => {
            set({ settings: newSettings })
            setLocalStorage("juaafya_settings", JSON.stringify(newSettings))
            get().actions.showToast("Settings saved successfully!")
        },
    },
})

import type { StateCreator } from "zustand"
import type { Appointment } from "../types"
import { db } from "../services/db"

export interface AppointmentSlice {
    appointments: Appointment[]
    actions: {
        setAppointments: (appointments: Appointment[]) => void
        addAppointment: (appointment: Appointment) => Promise<void>
        updateAppointment: (appointment: Appointment) => Promise<void>
    }
}

export const createAppointmentSlice: StateCreator<
    AppointmentSlice & { isDemoMode: boolean; actions: { showToast: (msg: string, type?: "success" | "error" | "info") => void } },
    [],
    [],
    AppointmentSlice
> = (set, get) => ({
    appointments: [],
    actions: {
        setAppointments: (appointments) => set({ appointments }),
        addAppointment: async (newAppt) => {
            try {
                const saved = await db.createAppointment(newAppt)
                if (!saved) throw new Error('Failed to create appointment')
                set((state) => ({ appointments: [...state.appointments, saved] }))
                get().actions.showToast(`Appointment scheduled for ${saved.patientName}.`)
            } catch (e) {
                console.error('addAppointment error', e)
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
                console.error('updateAppointment error', e)
                get().actions.showToast("Error updating appointment", "error")
            }
        },
    },
})

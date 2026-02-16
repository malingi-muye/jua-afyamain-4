import type { StateCreator } from "zustand"
import type { Patient } from "../types"
import { db } from "../services/db"

export interface PatientSlice {
    patients: Patient[]
    actions: {
        addPatient: (patient: Patient) => Promise<void>
        updatePatient: (patient: Patient) => Promise<void>
        deletePatient: (id: string) => Promise<void>
        setPatients: (patients: Patient[]) => void
    }
}

export const createPatientSlice: StateCreator<
    PatientSlice & { isDemoMode: boolean; actions: { showToast: (msg: string, type?: "success" | "error" | "info") => void } },
    [],
    [],
    PatientSlice
> = (set, get) => ({
    patients: [],
    actions: {
        setPatients: (patients) => set({ patients }),
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
    },
})

import type { StateCreator } from "zustand"
import type { Visit, Patient } from "../types"
import { db } from "../services/db"

export interface VisitSlice {
    visits: Visit[]
    actions: {
        setVisits: (visits: Visit[]) => void
        addVisit: (patientId: string, priority?: string, insurance?: any, skipVitals?: boolean) => Promise<void>
        updateVisit: (visit: Visit) => Promise<void>
        dispensePrescription: (visit: Visit) => Promise<void>
        completeVisit: (visit: Visit) => Promise<void>
    }
}

export const createVisitSlice: StateCreator<
    VisitSlice & {
        isDemoMode: boolean
        patients: Patient[]
        inventory: any[]
        actions: {
            showToast: (msg: string, type?: "success" | "error" | "info") => void
            updatePatient: (patient: Patient) => Promise<void>
            updateInventoryItem: (item: any) => Promise<void>
        }
    },
    [],
    [],
    VisitSlice
> = (set, get) => ({
    visits: [],
    actions: {
        setVisits: (visits) => set({ visits }),
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
                vitals: { bp: "", temp: "", weight: "", height: "", heartRate: "", respRate: "", spo2: "" },
            }

            try {
                const saved = await db.createVisit(newVisit)
                if (!saved) throw new Error('Failed to create visit')
                set((state) => ({ visits: [...state.visits, saved] }))
                get().actions.showToast(`${patient.name} checked in.`)
            } catch (e) {
                console.error('addVisit error', e)
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
                console.error('updateVisit error', e)
                get().actions.showToast("Error updating visit", "error")
            }
        },
        dispensePrescription: async (visit) => {
            const updatedInventory = [...get().inventory]
            visit.prescription.forEach((med) => {
                const itemIndex = updatedInventory.findIndex((i) => i.id === med.inventoryId)
                if (itemIndex > -1) {
                    const item = updatedInventory[itemIndex]
                    const newStock = Math.max(0, item.stock - med.quantity)
                    updatedInventory[itemIndex] = { ...item, stock: newStock }

                    // Persist inventory change
                    db.updateInventoryItem(updatedInventory[itemIndex]).catch((err) => console.error('updateInventoryItem error', err))
                }
            })
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
            const diagnosisText = visit.diagnosis ? `Dx: ${visit.diagnosis}` : "No Diagnosis"
            const notesText = visit.doctorNotes ? `Notes: ${visit.doctorNotes}` : ""
            const summary = `[${visit.startTime.split("T")[0]}] ${diagnosisText}. ${notesText}`.trim()

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
            get().actions.showToast("Visit finalized.", "success")
        },
    },
})

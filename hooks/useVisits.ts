import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { db } from "../services/db"
import type { Visit } from "../types"
import useStore from "../store"

// Query keys
export const visitKeys = {
    all: ["visits"] as const,
    active: () => [...visitKeys.all, "active"] as const,
    detail: (id: string) => [...visitKeys.all, id] as const,
}

// Fetch all visits (non-completed)
export function useVisits() {
    return useQuery({
        queryKey: visitKeys.active(),
        queryFn: async () => (await db.getVisits()).filter((v) => v.stage !== "Completed"),
        staleTime: 1000 * 60 * 1, // 1 minute - visits change frequently
    })
}

// Create visit mutation
export function useCreateVisit() {
    const queryClient = useQueryClient()
    const { actions, patients } = useStore()

    return useMutation({
        mutationFn: async ({
            patientId,
            priority = "Normal",
            skipVitals = false
        }: {
            patientId: string
            priority?: string
            skipVitals?: boolean
        }) => {
            const patient = patients.find((p) => p.id === patientId)
            if (!patient) throw new Error("Patient not found")

            const newVisit: Visit = {
                id: `V${Date.now()}`,
                patientId: patient.id,
                patientName: patient.name,
                stage: skipVitals ? "Consultation" : "Vitals",
                stageStartTime: new Date().toISOString(),
                startTime: new Date().toISOString(),
                queueNumber: 0, // Will be set by server
                priority: priority as any,
                labOrders: [],
                prescription: [],
                medicationsDispensed: false,
                consultationFee: 500,
                totalBill: 500,
                paymentStatus: "Pending",
                vitals: { bp: "", heartRate: "", temp: "", weight: "", height: "", respRate: "", spo2: "" },
            }

            return db.createVisit(newVisit)
        },
        onSuccess: (visit) => {
            queryClient.invalidateQueries({ queryKey: visitKeys.all })
            actions.showToast(`${visit.patientName} checked in.`)
        },
        onError: () => {
            actions.showToast("Error checking in patient", "error")
        },
    })
}

// Update visit mutation
export function useUpdateVisit() {
    const queryClient = useQueryClient()
    const { actions } = useStore()

    return useMutation({
        mutationFn: async (visit: Visit) => {
            await db.updateVisit(visit)
            return visit
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: visitKeys.all })
        },
        onError: () => {
            actions.showToast("Error updating visit", "error")
        },
    })
}

// Complete visit mutation
export function useCompleteVisit() {
    const queryClient = useQueryClient()
    const { actions, patients } = useStore()

    return useMutation({
        mutationFn: async (visit: Visit) => {
            const diagnosisText = visit.diagnosis ? `Dx: ${visit.diagnosis}` : "No Diagnosis"
            const notesText = visit.doctorNotes ? `Notes: ${visit.doctorNotes}` : ""
            const summary = `[${visit.startTime.split("T")[0]}] ${diagnosisText}. ${notesText}`.trim()

            const patient = patients.find((p) => p.id === visit.patientId)
            if (patient) {
                const updatedPatient = {
                    ...patient,
                    lastVisit: new Date().toISOString().split("T")[0],
                    history: [summary, ...patient.history],
                }
                await actions.updatePatient(updatedPatient)
            }

            const completedVisit = { ...visit, stage: "Completed" as const }
            await actions.updateVisit(completedVisit)

            return completedVisit
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: visitKeys.all })
            actions.showToast("Visit finalized.", "success")
        },
        onError: () => {
            actions.showToast("Error completing visit", "error")
        },
    })
}

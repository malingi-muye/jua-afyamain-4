import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { db } from "../services/db"
import type { Patient } from "../types"
import useStore from "../store"

// Query keys
export const patientKeys = {
    all: ["patients"] as const,
    detail: (id: string) => [...patientKeys.all, id] as const,
}

// Fetch all patients
export function usePatients() {
    const { actions } = useStore()

    return useQuery({
        queryKey: patientKeys.all,
        queryFn: async () => db.getPatients(),
        staleTime: 1000 * 60 * 5, // 5 minutes
    })
}

// Create patient mutation
export function useCreatePatient() {
    const queryClient = useQueryClient()
    const { actions: storeActions } = useStore()

    return useMutation({
        mutationFn: async (patient: Patient) => db.createPatient(patient),
        onSuccess: (newPatient) => {
            queryClient.invalidateQueries({ queryKey: patientKeys.all })
            storeActions.showToast(`Patient ${newPatient.name} added successfully!`)
        },
        onError: () => {
            storeActions.showToast("Error adding patient", "error")
        },
    })
}

// Update patient mutation
export function useUpdatePatient() {
    const queryClient = useQueryClient()
    const { actions: storeActions } = useStore()

    return useMutation({
        mutationFn: async (patient: Patient) => {
            await db.updatePatient(patient)
            return patient
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: patientKeys.all })
            storeActions.showToast("Patient record updated.")
        },
        onError: () => {
            storeActions.showToast("Error updating patient", "error")
        },
    })
}

// Delete patient mutation
export function useDeletePatient() {
    const queryClient = useQueryClient()
    const { actions: storeActions } = useStore()

    return useMutation({
        mutationFn: async (id: string) => {
            await db.deletePatient(id)
            return id
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: patientKeys.all })
            storeActions.showToast("Patient deleted.", "info")
        },
        onError: () => {
            storeActions.showToast("Error deleting patient", "error")
        },
    })
}

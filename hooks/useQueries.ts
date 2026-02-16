/**
 * React Query Hooks for Data Fetching
 * Implements: Batching, Caching, Background Sync
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../services/db'
import type { Patient, Appointment, InventoryItem, Visit, Supplier, ClinicSettings } from '../types'
import useStore from '../store'
import { performanceMonitor } from '../lib/performance'

// Query Keys
export const queryKeys = {
    patients: ['patients'] as const,
    appointments: ['appointments'] as const,
    inventory: ['inventory'] as const,
    visits: ['visits'] as const,
    suppliers: ['suppliers'] as const,
    settings: ['settings'] as const,
}

// ============ PATIENTS ============

export function usePatients() {
    return useQuery({
        queryKey: queryKeys.patients,
        queryFn: async () => {
            performanceMonitor.mark('api_patients')
            const data = await db.getPatients()
            performanceMonitor.measure('api_patients', { count: data.length })
            return data
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 15, // 15 minutes cache retention
    })
}

export function useCreatePatient() {
    const queryClient = useQueryClient()
    const actions = useStore(state => state.actions)

    return useMutation({
        mutationFn: async (patient: Patient) => db.createPatient(patient),
        onMutate: async (newPatient) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: queryKeys.patients })

            // Snapshot previous value
            const previousPatients = queryClient.getQueryData<Patient[]>(queryKeys.patients)

            // Optimistically update
            if (previousPatients) {
                queryClient.setQueryData<Patient[]>(queryKeys.patients, [...previousPatients, newPatient])
            }

            return { previousPatients }
        },
        onError: (_err, _newPatient, context) => {
            // Rollback on error
            if (context?.previousPatients) {
                queryClient.setQueryData(queryKeys.patients, context.previousPatients)
            }
            actions.showToast('Error adding patient', 'error')
        },
        onSuccess: (data) => {
            actions.showToast(`Patient ${data.name} added successfully!`)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.patients })
        },
    })
}

export function useUpdatePatient() {
    const queryClient = useQueryClient()
    const actions = useStore(state => state.actions)

    return useMutation({
        mutationFn: async (patient: Patient) => {
            await db.updatePatient(patient)
            return patient
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.patients })
            actions.showToast('Patient record updated.')
        },
        onError: () => {
            actions.showToast('Error updating patient', 'error')
        },
    })
}

export function useDeletePatient() {
    const queryClient = useQueryClient()
    const actions = useStore(state => state.actions)

    return useMutation({
        mutationFn: async (id: string) => db.deletePatient(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.patients })
            actions.showToast('Patient deleted.', 'info')
        },
        onError: () => {
            actions.showToast('Error deleting patient', 'error')
        },
    })
}

// ============ APPOINTMENTS ============

export function useAppointments() {
    return useQuery({
        queryKey: queryKeys.appointments,
        queryFn: async () => {
            performanceMonitor.mark('api_appointments')
            const data = await db.getAppointments()
            performanceMonitor.measure('api_appointments', { count: data.length })
            return data
        },
        staleTime: 1000 * 60 * 3, // 3 minutes
        gcTime: 1000 * 60 * 10, // 10 minutes cache retention
    })
}

export function useCreateAppointment() {
    const queryClient = useQueryClient()
    const actions = useStore(state => state.actions)

    return useMutation({
        mutationFn: async (appointment: Appointment) => db.createAppointment(appointment),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.appointments })
            actions.showToast(`Appointment scheduled for ${data.patientName}.`)
        },
        onError: () => {
            actions.showToast('Error scheduling appointment', 'error')
        },
    })
}

export function useUpdateAppointment() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (appointment: Appointment) => db.updateAppointment(appointment),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.appointments })
        },
    })
}

// ============ INVENTORY ============

export function useInventory() {
    return useQuery({
        queryKey: queryKeys.inventory,
        queryFn: async () => {
            performanceMonitor.mark('api_inventory')
            const data = await db.getInventory()
            performanceMonitor.measure('api_inventory', { count: data.length })
            return data
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 15, // 15 minutes cache retention
    })
}

export function useCreateInventoryItem() {
    const queryClient = useQueryClient()
    const actions = useStore(state => state.actions)

    return useMutation({
        mutationFn: async (item: InventoryItem) => db.createInventoryItem(item),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory })
            actions.showToast(`${data.name} added to inventory.`)
        },
        onError: () => {
            actions.showToast('Error creating item', 'error')
        },
    })
}

export function useUpdateInventoryItem() {
    const queryClient = useQueryClient()
    const actions = useStore(state => state.actions)

    return useMutation({
        mutationFn: async (item: InventoryItem) => {
            await db.updateInventoryItem(item)
            return item
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory })
            actions.showToast(`${data.name} updated.`)
        },
        onError: () => {
            actions.showToast('Error updating item', 'error')
        },
    })
}

// ============ VISITS ============

export function useVisits() {
    return useQuery({
        queryKey: queryKeys.visits,
        queryFn: async () => {
            performanceMonitor.mark('api_visits')
            const data = await db.getVisits()
            performanceMonitor.measure('api_visits', { count: data.length })
            return data
        },
        staleTime: 1000 * 30, // 30 seconds (visits change frequently)
        gcTime: 1000 * 60 * 5, // 5 minutes cache retention
        // Only auto-refresh when the tab is visible to save bandwidth
        refetchInterval: 1000 * 60, // Auto-refresh every minute
        refetchIntervalInBackground: false, // Don't poll when tab is hidden
    })
}

export function useCreateVisit() {
    const queryClient = useQueryClient()
    const actions = useStore(state => state.actions)

    return useMutation({
        mutationFn: async (visit: Visit) => db.createVisit(visit),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.visits })
            actions.showToast(`${data.patientName} checked in.`)
        },
        onError: () => {
            actions.showToast('Error checking in patient', 'error')
        },
    })
}

export function useUpdateVisit() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (visit: Visit) => db.updateVisit(visit),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.visits })
        },
    })
}

// ============ SUPPLIERS ============

export function useSuppliers() {
    return useQuery({
        queryKey: queryKeys.suppliers,
        queryFn: async () => db.getSuppliers(),
        staleTime: 1000 * 60 * 10, // 10 minutes (suppliers rarely change)
        gcTime: 1000 * 60 * 30, // 30 minutes cache retention
    })
}

// ============ SETTINGS ============

export function useSettings() {
    return useQuery({
        queryKey: queryKeys.settings,
        queryFn: async () => db.getSettings(),
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 30, // 30 minutes cache retention (settings rarely change)
    })
}

export function useUpdateSettings() {
    const queryClient = useQueryClient()
    const actions = useStore(state => state.actions)
    const currentUser = useStore(state => state.currentUser)

    return useMutation({
        mutationFn: async (settings: ClinicSettings) =>
            db.updateSettings(settings, currentUser?.clinicId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.settings })
            actions.showToast('Settings saved successfully!')
        },
        onError: () => {
            actions.showToast('Error saving settings', 'error')
        },
    })
}

/**
 * Prefetch all data for faster navigation
 * Call this after successful login
 */
export function usePrefetchData() {
    const queryClient = useQueryClient()

    return () => {
        queryClient.prefetchQuery({
            queryKey: queryKeys.patients,
            queryFn: () => db.getPatients(),
            staleTime: 1000 * 60 * 5,
        })
        queryClient.prefetchQuery({
            queryKey: queryKeys.appointments,
            queryFn: () => db.getAppointments(),
            staleTime: 1000 * 60 * 3,
        })
        queryClient.prefetchQuery({
            queryKey: queryKeys.inventory,
            queryFn: () => db.getInventory(),
            staleTime: 1000 * 60 * 5,
        })
        queryClient.prefetchQuery({
            queryKey: queryKeys.suppliers,
            queryFn: () => db.getSuppliers(),
            staleTime: 1000 * 60 * 10,
        })
        queryClient.prefetchQuery({
            queryKey: queryKeys.visits,
            queryFn: () => db.getVisits(),
            staleTime: 1000 * 30,
        })
        queryClient.prefetchQuery({
            queryKey: queryKeys.settings,
            queryFn: () => db.getSettings(),
            staleTime: 1000 * 60 * 5,
        })
    }
}

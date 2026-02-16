"use client"

import { useState } from "react"
// Deletions should use centralized store actions which call server-side guarded services
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Trash2, Edit2, Phone, Mail, Calendar } from "lucide-react"
import { canCurrentUser } from '@/lib/roleMapper'
import useStore from '@/store'
import type { Patient, Clinic } from "@/types/database"

interface PatientListProps {
  patients: Patient[]
  onEdit: (patient: Patient) => void
  onRefresh: () => void
  clinic: Clinic | null
}

export function PatientList({ patients, onEdit, onRefresh, clinic }: PatientListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const canDelete = canCurrentUser('patients.delete')

  const handleDelete = async (patientId: string) => {
    try {
      await useStore.getState().actions.deletePatient(patientId)
      setDeletingId(null)
      onRefresh()
    } catch (error) {
      console.error("[v1] Error deleting patient via store action:", error)
      useStore.getState().actions.showToast('Error deleting patient.', 'error')
    }
  }

  if (patients.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-slate-600 dark:text-slate-400">No patients found. Add a patient to get started.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {patients.map((patient) => (
        <Card key={patient.id} className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between gap-4">
            {/* Patient Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg text-slate-900 dark:text-white">{patient.full_name}</h3>
                <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                  {patient.mrn}
                </span>
              </div>
              <div className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                {patient.phone_number && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {patient.phone_number}
                  </div>
                )}
                {patient.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {patient.email}
                  </div>
                )}
                {patient.date_of_birth && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Age: {new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()}
                  </div>
                )}
              </div>
              {patient.chronic_conditions && patient.chronic_conditions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {patient.chronic_conditions.map((condition) => (
                    <span
                      key={condition}
                      className="px-2 py-1 rounded text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                    >
                      {condition}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onEdit(patient)}>
                <Edit2 className="w-4 h-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={!canDelete} aria-disabled={!canDelete}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogTitle>Delete Patient</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {patient.full_name}? This action cannot be undone.
                  </AlertDialogDescription>
                  <div className="flex justify-end gap-4">
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        if (!canDelete) {
                          useStore.getState().actions.showToast('You do not have permission to delete patients.', 'error')
                          return
                        }
                        handleDelete(patient.id)
                      }}
                      className="bg-red-600 hover:bg-red-700"
                      disabled={!canDelete}
                    >
                      Delete
                    </AlertDialogAction>
                  </div>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

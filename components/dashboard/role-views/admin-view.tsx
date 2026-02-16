'use client'

import { Patient, Appointment, InventoryItem, Visit, Supplier } from '@/types'
import DashboardContent from '../dashboard-content'

interface AdminViewProps {
  user: {
    id: string
    email: string
    name: string
    role: string
    avatar_url: string | null
  }
  initialData: {
    patients: Patient[]
    appointments: Appointment[]
    inventory: InventoryItem[]
    visits: Visit[]
    suppliers: Supplier[]
  }
}

export default function AdminDashboardView({ user, initialData }: AdminViewProps) {
  return <DashboardContent user={user} initialData={initialData} />
}

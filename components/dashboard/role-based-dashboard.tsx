'use client'

import { Patient, Appointment, InventoryItem, Visit, Supplier } from '@/types'
import DashboardContent from './dashboard-content'
import AdminDashboardView from './role-views/admin-view'
import DoctorDashboardView from './role-views/doctor-view'
import NurseDashboardView from './role-views/nurse-view'
import ReceptionistDashboardView from './role-views/receptionist-view'

interface RoleBasedDashboardProps {
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

export default function RoleBasedDashboard({
  user,
  initialData,
}: RoleBasedDashboardProps) {
  switch (user.role?.toLowerCase()) {
    case 'admin':
      return <AdminDashboardView user={user} initialData={initialData} />
    case 'doctor':
      return <DoctorDashboardView user={user} initialData={initialData} />
    case 'nurse':
      return <NurseDashboardView user={user} initialData={initialData} />
    case 'receptionist':
      return <ReceptionistDashboardView user={user} initialData={initialData} />
    default:
      // Default to full dashboard for other roles
      return <DashboardContent user={user} initialData={initialData} />
  }
}

'use client'

import { useState, useMemo } from 'react'
import { Patient, Appointment, InventoryItem, Visit, Supplier } from '@/types'
import DashboardHeader from '../dashboard-header'
import DashboardAlerts from '../dashboard-alerts'
import { Calendar, Users, Clock, AlertCircle } from 'lucide-react'

interface ReceptionistViewProps {
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

export default function ReceptionistDashboardView({
  user,
  initialData,
}: ReceptionistViewProps) {
  const [data] = useState(initialData)

  const metrics = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const todayAppointments = data.appointments.filter((a) => a.date === today)
    const completedAppointments = todayAppointments.filter(
      (a) => a.status === 'Completed'
    )
    const checkedInPatients = data.visits.filter((v) => v.stage !== 'Check-In')

    return {
      appointmentsToday: todayAppointments.length,
      completedAppointments: completedAppointments.length,
      checkedInPatients: checkedInPatients.length,
      noShowCount: data.appointments.filter((a) => a.status === 'No-Show').length,
    }
  }, [data])

  const todayAppointments = data.appointments
    .filter((a) => a.date === new Date().toISOString().split('T')[0])
    .sort((a, b) => a.time.localeCompare(b.time))

  const upcomingCheckIns = data.visits
    .filter((v) => v.stage === 'Check-In')
    .sort((a, b) => {
      if (!a.startTime || !b.startTime) return 0
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    })
    .slice(0, 10)

  const getAppointmentStatus = (appt: Appointment) => {
    const visit = data.visits.find(
      (v) => v.patientId === appt.patientId && v.startTime
    )
    if (appt.status === 'Completed') return 'Completed'
    if (appt.status === 'No-Show') return 'No Show'
    if (visit && visit.stage !== 'Check-In') return 'Checked In'
    return 'Pending'
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto">
        <DashboardHeader user={user} />

        {/* Alerts */}
        <DashboardAlerts
          lowStockItems={[]}
          appointmentsToday={todayAppointments}
          patientsInQueue={upcomingCheckIns}
        />

        {/* Quick Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Today's Appointments
                </p>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                  {metrics.appointmentsToday}
                </h3>
              </div>
              <Calendar className="w-10 h-10 text-blue-600 dark:text-blue-400 opacity-20" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Checked In
                </p>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                  {metrics.checkedInPatients}
                </h3>
              </div>
              <Users className="w-10 h-10 text-green-600 dark:text-green-400 opacity-20" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Completed
                </p>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                  {metrics.completedAppointments}
                </h3>
              </div>
              <Clock className="w-10 h-10 text-purple-600 dark:text-purple-400 opacity-20" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  No Shows
                </p>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                  {metrics.noShowCount}
                </h3>
              </div>
              <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400 opacity-20" />
            </div>
          </div>
        </div>

        {/* Appointments & Check-ins */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Appointments */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Today's Appointments Schedule
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {todayAppointments.length > 0 ? (
                todayAppointments.map((appt) => {
                  const status = getAppointmentStatus(appt)
                  const statusColors = {
                    'Pending': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
                    'Checked In': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
                    'Completed': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                    'No Show': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
                  }

                  return (
                    <div
                      key={appt.id}
                      className="p-4 border border-slate-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {appt.time}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {appt.patientName}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            statusColors[status as keyof typeof statusColors] ||
                            statusColors['Pending']
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {appt.reason}
                      </p>
                    </div>
                  )
                })
              ) : (
                <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                  No appointments scheduled for today
                </p>
              )}
            </div>
          </div>

          {/* Pending Check-ins */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Pending Check-ins
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {upcomingCheckIns.length > 0 ? (
                upcomingCheckIns.map((visit) => (
                  <div
                    key={visit.id}
                    className="p-4 border border-slate-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {visit.patientName}
                        </p>
                        {visit.priority && (
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Priority: <span className="font-medium">{visit.priority}</span>
                          </p>
                        )}
                      </div>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                        {visit.stage}
                      </span>
                    </div>
                    <button className="mt-2 w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors">
                      Check In Patient
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                  No pending check-ins
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

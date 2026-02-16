'use client'

import { useState, useMemo } from 'react'
import { Patient, Appointment, InventoryItem, Visit, Supplier } from '@/types'
import DashboardHeader from '../dashboard-header'
import DashboardAlerts from '../dashboard-alerts'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { Activity, Users, Calendar, Clock } from 'lucide-react'

interface DoctorViewProps {
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

export default function DoctorDashboardView({ user, initialData }: DoctorViewProps) {
  const [data] = useState(initialData)

  const metrics = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const todayAppointments = data.appointments.filter((a) => a.date === today)
    const todayVisits = data.visits.filter((v) => {
      const visitDate = new Date(v.startTime || new Date()).toISOString().split('T')[0]
      return visitDate === today
    })
    const completedVisits = todayVisits.filter((v) => v.stage === 'Completed')

    return {
      todayAppointments: todayAppointments.length,
      patientsSeenToday: completedVisits.length,
      patientsInQueue: data.visits.filter((v) => v.stage !== 'Completed').length,
      totalPatients: data.patients.length,
    }
  }, [data])

  const appointmentTrends = useMemo(() => {
    const last7Days = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().split('T')[0]
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
      const count = data.appointments.filter((a) => a.date === dateStr).length
      last7Days.push({ day: dayName, count })
    }
    return last7Days
  }, [data])

  const recentConsultations = data.visits
    .filter((v) => v.chiefComplaint || v.diagnosis)
    .sort((a, b) => new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime())
    .slice(0, 5)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto">
        <DashboardHeader user={user} />

        {/* Alerts */}
        <DashboardAlerts
          lowStockItems={data.inventory.filter((i) => i.stock <= i.minStockLevel)}
          appointmentsToday={data.appointments.filter(
            (a) => a.date === new Date().toISOString().split('T')[0]
          )}
          patientsInQueue={data.visits.filter((v) => v.stage !== 'Completed')}
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
                  {metrics.todayAppointments}
                </h3>
              </div>
              <Calendar className="w-10 h-10 text-blue-600 dark:text-blue-400 opacity-20" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Patients Seen Today
                </p>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                  {metrics.patientsSeenToday}
                </h3>
              </div>
              <Activity className="w-10 h-10 text-green-600 dark:text-green-400 opacity-20" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  In Queue
                </p>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                  {metrics.patientsInQueue}
                </h3>
              </div>
              <Users className="w-10 h-10 text-purple-600 dark:text-purple-400 opacity-20" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Total Patients
                </p>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                  {metrics.totalPatients}
                </h3>
              </div>
              <Clock className="w-10 h-10 text-amber-600 dark:text-amber-400 opacity-20" />
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Appointments (Last 7 Days)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={appointmentTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3B82F6"
                  dot={{ fill: '#3B82F6', r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Diagnosis Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={Object.entries(
                  data.visits.reduce(
                    (acc, v) => {
                      if (v.diagnosis) {
                        acc[v.diagnosis] = (acc[v.diagnosis] || 0) + 1
                      }
                      return acc
                    },
                    {} as Record<string, number>
                  )
                )
                  .slice(0, 5)
                  .map(([diagnosis, count]) => ({ diagnosis, count }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="diagnosis" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="count" fill="#10B981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Consultations */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Recent Consultations
          </h3>
          <div className="space-y-3">
            {recentConsultations.length > 0 ? (
              recentConsultations.map((visit) => (
                <div
                  key={visit.id}
                  className="p-4 border border-slate-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {visit.patientName}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {visit.chiefComplaint && `Chief Complaint: ${visit.chiefComplaint}`}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        visit.stage === 'Completed'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      }`}
                    >
                      {visit.stage}
                    </span>
                  </div>
                  {visit.diagnosis && (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Diagnosis: {visit.diagnosis}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                No recent consultations
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

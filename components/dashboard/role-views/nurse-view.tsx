'use client'

import { useState, useMemo } from 'react'
import { Patient, Appointment, InventoryItem, Visit, Supplier } from '@/types'
import DashboardHeader from '../dashboard-header'
import DashboardAlerts from '../dashboard-alerts'
import { Activity, Users, Heart, Droplets } from 'lucide-react'

interface NurseViewProps {
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

export default function NurseDashboardView({ user, initialData }: NurseViewProps) {
  const [data] = useState(initialData)

  const metrics = useMemo(() => {
    const patientsInQueue = data.visits.filter((v) => v.stage !== 'Completed')
    const vitalsRecorded = data.visits.filter((v) => v.vitals && Object.keys(v.vitals).length > 0)

    return {
      patientsInQueue: patientsInQueue.length,
      vitalsRecorded: vitalsRecorded.length,
      totalPatients: data.patients.length,
      appointmentsToday: data.appointments.filter(
        (a) => a.date === new Date().toISOString().split('T')[0]
      ).length,
    }
  }, [data])

  const patientsAwaitingTriage = data.visits
    .filter((v) => v.stage === 'Check-In' || v.stage === 'Vitals')
    .sort((a, b) => {
      if (!a.startTime || !b.startTime) return 0
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    })
    .slice(0, 10)

  const recentVitals = data.visits
    .filter((v) => v.vitals && Object.keys(v.vitals).length > 0)
    .sort((a, b) => {
      if (!a.stageStartTime || !b.stageStartTime) return 0
      return new Date(b.stageStartTime).getTime() - new Date(a.stageStartTime).getTime()
    })
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
                  Patients In Queue
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
                  Vitals Recorded
                </p>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                  {metrics.vitalsRecorded}
                </h3>
              </div>
              <Heart className="w-10 h-10 text-red-600 dark:text-red-400 opacity-20" />
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
              <Activity className="w-10 h-10 text-green-600 dark:text-green-400 opacity-20" />
            </div>
          </div>

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
              <Droplets className="w-10 h-10 text-blue-600 dark:text-blue-400 opacity-20" />
            </div>
          </div>
        </div>

        {/* Patients Awaiting Triage */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Patients Awaiting Triage
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {patientsAwaitingTriage.length > 0 ? (
                patientsAwaitingTriage.map((visit) => {
                  const patient = data.patients.find((p) => p.id === visit.patientId)
                  return (
                    <div
                      key={visit.id}
                      className="p-4 border border-slate-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {visit.patientName}
                          </p>
                          {patient && (
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              Age: {patient.age} | {patient.gender}
                            </p>
                          )}
                        </div>
                        <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                          {visit.stage}
                        </span>
                      </div>
                      {visit.priority && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Priority: <span className="font-medium">{visit.priority}</span>
                        </p>
                      )}
                    </div>
                  )
                })
              ) : (
                <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                  No patients awaiting triage
                </p>
              )}
            </div>
          </div>

          {/* Recent Vitals */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Recent Vitals Recorded
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recentVitals.length > 0 ? (
                recentVitals.map((visit) => (
                  <div
                    key={visit.id}
                    className="p-4 border border-slate-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <p className="font-semibold text-slate-900 dark:text-white mb-2">
                      {visit.patientName}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {visit.vitals?.bp && (
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-2 rounded">
                          <p className="text-slate-500 dark:text-slate-400 text-xs">BP</p>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {visit.vitals.bp}
                          </p>
                        </div>
                      )}
                      {visit.vitals?.heartRate && (
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-2 rounded">
                          <p className="text-slate-500 dark:text-slate-400 text-xs">HR</p>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {visit.vitals.heartRate} bpm
                          </p>
                        </div>
                      )}
                      {visit.vitals?.temp && (
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-2 rounded">
                          <p className="text-slate-500 dark:text-slate-400 text-xs">Temp</p>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {visit.vitals.temp}°C
                          </p>
                        </div>
                      )}
                      {visit.vitals?.weight && (
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-2 rounded">
                          <p className="text-slate-500 dark:text-slate-400 text-xs">Weight</p>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {visit.vitals.weight} kg
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                  No vitals recorded
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

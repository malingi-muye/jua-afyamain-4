'use client'

import { useState } from 'react'
import { AlertCircle, Check, Clock, Package, X } from 'lucide-react'
import { InventoryItem, Appointment, Visit } from '@/types'

interface DashboardAlertsProps {
  lowStockItems: InventoryItem[]
  appointmentsToday: Appointment[]
  patientsInQueue: Visit[]
}

export default function DashboardAlerts({
  lowStockItems,
  appointmentsToday,
  patientsInQueue,
}: DashboardAlertsProps) {
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([])

  const dismissAlert = (id: string) => {
    setDismissedAlerts((prev) => [...prev, id])
  }

  const alerts = [
    ...(lowStockItems.length > 0 && !dismissedAlerts.includes('low-stock')
      ? [
          {
            id: 'low-stock',
            type: 'warning',
            icon: Package,
            title: 'Low Stock Alert',
            message: `${lowStockItems.length} items are below minimum stock levels`,
            action: 'Review Inventory',
            actionLink: '/inventory',
          },
        ]
      : []),
    ...(appointmentsToday.length > 0 &&
    !dismissedAlerts.includes('appointments-today')
      ? [
          {
            id: 'appointments-today',
            type: 'info',
            icon: Clock,
            title: 'Appointments Today',
            message: `You have ${appointmentsToday.length} appointment${appointmentsToday.length > 1 ? 's' : ''} scheduled for today`,
            action: 'View Appointments',
            actionLink: '/appointments',
          },
        ]
      : []),
    ...(patientsInQueue.length > 0 &&
    !dismissedAlerts.includes('patients-queue')
      ? [
          {
            id: 'patients-queue',
            type: 'info',
            icon: AlertCircle,
            title: 'Patients In Queue',
            message: `${patientsInQueue.length} patient${patientsInQueue.length > 1 ? 's' : ''} waiting in queue`,
            action: 'Process Queue',
            actionLink: '/reception',
          },
        ]
      : []),
  ]

  if (alerts.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const Icon = alert.icon
        const bgColor =
          alert.type === 'warning'
            ? 'bg-amber-50 dark:bg-amber-900/20'
            : 'bg-blue-50 dark:bg-blue-900/20'
        const borderColor =
          alert.type === 'warning'
            ? 'border-amber-200 dark:border-amber-800'
            : 'border-blue-200 dark:border-blue-800'
        const textColor =
          alert.type === 'warning'
            ? 'text-amber-800 dark:text-amber-200'
            : 'text-blue-800 dark:text-blue-200'
        const iconColor =
          alert.type === 'warning'
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-blue-600 dark:text-blue-400'

        return (
          <div
            key={alert.id}
            className={`${bgColor} border ${borderColor} rounded-xl p-4 flex items-start gap-4 ${textColor} animate-in slide-in-from-top`}
          >
            <div className={`shrink-0 mt-0.5 ${iconColor}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold mb-1">{alert.title}</h4>
              <p className="text-sm opacity-90">{alert.message}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={alert.actionLink}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  alert.type === 'warning'
                    ? 'bg-amber-200 dark:bg-amber-900/40 hover:bg-amber-300 dark:hover:bg-amber-900/60'
                    : 'bg-blue-200 dark:bg-blue-900/40 hover:bg-blue-300 dark:hover:bg-blue-900/60'
                }`}
              >
                {alert.action}
              </a>
              <button
                onClick={() => dismissAlert(alert.id)}
                className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

'use client'

import {
  Users,
  Calendar,
  Activity,
  Pill,
  TrendingUp,
  TrendingDown,
  Clock,
  BarChart3,
} from 'lucide-react'

interface DashboardMetricsProps {
  metrics: {
    totalPatients: number
    newPatients: number
    todayAppointments: number
    upcomingAppointments: number
    inQueuePatients: number
    completedVisits: number
    lowStockItems: number
    totalRevenue: number
    revenueTrend: number
    appointmentCompletionRate: string
    averagePatientWaitTime: string
  }
}

export default function DashboardMetrics({
  metrics,
}: DashboardMetricsProps) {
  const metricCards = [
    {
      title: 'Total Patients',
      value: metrics.totalPatients,
      change: `+${metrics.newPatients} new`,
      trend: 'up',
      icon: Users,
      color: 'blue',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      iconBg: 'bg-blue-100 dark:bg-blue-900/40',
      textColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Today\'s Appointments',
      value: metrics.todayAppointments,
      change: `${metrics.upcomingAppointments} scheduled`,
      trend: 'neutral',
      icon: Calendar,
      color: 'green',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      iconBg: 'bg-green-100 dark:bg-green-900/40',
      textColor: 'text-green-600 dark:text-green-400',
    },
    {
      title: 'Patients In Queue',
      value: metrics.inQueuePatients,
      change: `${metrics.completedVisits} completed`,
      trend: 'up',
      icon: Activity,
      color: 'purple',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      iconBg: 'bg-purple-100 dark:bg-purple-900/40',
      textColor: 'text-purple-600 dark:text-purple-400',
    },
    {
      title: 'Low Stock Items',
      value: metrics.lowStockItems,
      change: 'Requires attention',
      trend: metrics.lowStockItems > 0 ? 'down' : 'up',
      icon: Pill,
      color: metrics.lowStockItems > 0 ? 'red' : 'teal',
      bgColor:
        metrics.lowStockItems > 0
          ? 'bg-red-50 dark:bg-red-900/20'
          : 'bg-teal-50 dark:bg-teal-900/20',
      iconBg:
        metrics.lowStockItems > 0
          ? 'bg-red-100 dark:bg-red-900/40'
          : 'bg-teal-100 dark:bg-teal-900/40',
      textColor:
        metrics.lowStockItems > 0
          ? 'text-red-600 dark:text-red-400'
          : 'text-teal-600 dark:text-teal-400',
    },
    {
      title: 'Total Revenue',
      value: `KSh ${(metrics.totalRevenue / 1000).toFixed(1)}K`,
      change: `${metrics.revenueTrend > 0 ? '+' : ''}${metrics.revenueTrend}% this month`,
      trend: metrics.revenueTrend > 0 ? 'up' : 'down',
      icon: BarChart3,
      color: 'amber',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      iconBg: 'bg-amber-100 dark:bg-amber-900/40',
      textColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      title: 'Appointment Completion',
      value: `${metrics.appointmentCompletionRate}%`,
      change: 'Monthly average',
      trend: 'up',
      icon: Calendar,
      color: 'indigo',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      iconBg: 'bg-indigo-100 dark:bg-indigo-900/40',
      textColor: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      title: 'Average Wait Time',
      value: `${metrics.averagePatientWaitTime} min`,
      change: 'Per patient',
      trend: 'up',
      icon: Clock,
      color: 'cyan',
      bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
      iconBg: 'bg-cyan-100 dark:bg-cyan-900/40',
      textColor: 'text-cyan-600 dark:text-cyan-400',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metricCards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.title}
            className={`${card.bgColor} rounded-2xl p-6 border border-slate-100 dark:border-slate-700 transition-all hover:shadow-lg`}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {card.title}
                </p>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white">
                  {card.value}
                </h3>
              </div>
              <div className={`${card.iconBg} p-3 rounded-lg`}>
                <Icon className={`w-6 h-6 ${card.textColor}`} />
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {card.trend === 'up' ? (
                <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
              ) : card.trend === 'down' ? (
                <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
              ) : (
                <div className="w-4 h-4" />
              )}
              <span className="text-slate-600 dark:text-slate-400">
                {card.change}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

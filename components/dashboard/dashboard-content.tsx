'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Patient, Appointment, InventoryItem, Visit, Supplier } from '@/types'
import DashboardHeader from './dashboard-header'
import DashboardMetrics from './dashboard-metrics'
import DashboardCharts from './dashboard-charts'
import DashboardFilters from './dashboard-filters'
import DashboardAlerts from './dashboard-alerts'
import { Button } from '@/components/ui/button'
import { Download, FileText } from 'lucide-react'
import { exportToCsv, exportToPdf } from '@/lib/export-utils'

interface DashboardContentProps {
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

export default function DashboardContent({
  user,
  initialData,
}: DashboardContentProps) {
  const [data, setData] = useState(initialData)
  const [filters, setFilters] = useState({
    dateRange: 'month',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    status: 'all',
    department: 'all',
    searchTerm: '',
  })

  // Real-time data refresh
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/dashboard/data')
        const freshData = await response.json()
        setData(freshData)
      } catch (error) {
        console.error('Failed to refresh dashboard data:', error)
      }
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [])

  // Calculate metrics from real data
  const metrics = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const todayAppointments = data.appointments.filter((a) => a.date === today)
    const lowStockItems = data.inventory.filter(
      (i) => i.stock <= i.minStockLevel
    )
    const totalRevenue = data.visits.reduce((sum, v) => sum + (v.totalBill || 0), 0)
    const completedVisits = data.visits.filter((v) => v.stage === 'Completed')
    const newPatients = data.patients.filter((p) => {
      const lastVisit = new Date(p.lastVisit)
      const daysAgo = (Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24)
      return daysAgo <= 30
    })

    // Calculate trends
    const previousMonthRevenue = data.visits
      .filter((v) => {
        const visitDate = new Date(v.startTime || new Date())
        const aMonthAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
        return visitDate < aMonthAgo && v.stage === 'Completed'
      })
      .reduce((sum, v) => sum + (v.totalBill || 0), 0)

    const revenueTrend =
      previousMonthRevenue > 0
        ? (((totalRevenue - previousMonthRevenue) / previousMonthRevenue) * 100).toFixed(1)
        : '0'

    return {
      totalPatients: data.patients.length,
      newPatients: newPatients.length,
      todayAppointments: todayAppointments.length,
      upcomingAppointments: data.appointments.filter(
        (a) => a.status === 'Scheduled'
      ).length,
      inQueuePatients: data.visits.filter((v) => v.stage !== 'Completed')
        .length,
      completedVisits: completedVisits.length,
      lowStockItems: lowStockItems.length,
      totalRevenue,
      revenueTrend: parseFloat(revenueTrend),
      appointmentCompletionRate:
        data.appointments.length > 0
          ? (
              (data.appointments.filter((a) => a.status === 'Completed')
                .length / data.appointments.length) *
              100
            ).toFixed(1)
          : '0',
      averagePatientWaitTime: data.visits.length > 0
        ? (
            data.visits.reduce(
              (sum, v) => {
                if (v.stageStartTime && v.startTime) {
                  const start = new Date(v.startTime).getTime()
                  const stageStart = new Date(v.stageStartTime).getTime()
                  return sum + (stageStart - start)
                }
                return sum
              },
              0
            ) / data.visits.length / 1000 / 60 // Convert to minutes
          ).toFixed(0)
        : '0',
    }
  }, [data])

  // Filter data based on current filters
  const filteredData = useMemo(() => {
    let filteredAppointments = data.appointments

    if (filters.status !== 'all') {
      filteredAppointments = filteredAppointments.filter(
        (a) => a.status === filters.status
      )
    }

    if (filters.searchTerm) {
      filteredAppointments = filteredAppointments.filter(
        (a) =>
          a.patientName
            .toLowerCase()
            .includes(filters.searchTerm.toLowerCase()) ||
          a.reason.toLowerCase().includes(filters.searchTerm.toLowerCase())
      )
    }

    filteredAppointments = filteredAppointments.filter((a) => {
      const appointmentDate = new Date(a.date)
      return (
        appointmentDate >= new Date(filters.startDate) &&
        appointmentDate <= new Date(filters.endDate)
      )
    })

    return {
      appointments: filteredAppointments,
      patients: data.patients,
      inventory: data.inventory,
      visits: data.visits,
    }
  }, [data, filters])

  // Export functions
  const handleExport = useCallback(
    (format: 'csv' | 'pdf') => {
      const exportData = {
        metrics,
        appointments: filteredData.appointments,
        patients: filteredData.patients,
        inventory: filteredData.inventory.filter(
          (i) => i.stock <= i.minStockLevel
        ),
      }

      if (format === 'csv') {
        exportToCsv(exportData, `dashboard-report-${new Date().toISOString().split('T')[0]}`)
      } else {
        exportToPdf(exportData, `dashboard-report-${new Date().toISOString().split('T')[0]}`)
      }
    },
    [metrics, filteredData]
  )

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <DashboardHeader user={user} />

        {/* Export Controls */}
        <div className="flex gap-2">
          <Button
            onClick={() => handleExport('csv')}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button
            onClick={() => handleExport('pdf')}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <FileText className="w-4 h-4" />
            Export PDF
          </Button>
        </div>

        {/* Filters */}
        <DashboardFilters
          filters={filters}
          onFilterChange={(newFilters) =>
            setFilters((prev) => ({ ...prev, ...newFilters }))
          }
        />

        {/* Alerts */}
        <DashboardAlerts
          lowStockItems={data.inventory.filter(
            (i) => i.stock <= i.minStockLevel
          )}
          appointmentsToday={data.appointments.filter(
            (a) => a.date === new Date().toISOString().split('T')[0]
          )}
          patientsInQueue={data.visits.filter(
            (v) => v.stage !== 'Completed'
          )}
        />

        {/* Metrics Grid */}
        <DashboardMetrics metrics={metrics} />

        {/* Charts */}
        <DashboardCharts
          appointments={filteredData.appointments}
          visits={filteredData.visits}
          inventory={filteredData.inventory}
        />
      </div>
    </div>
  )
}

'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Appointment, Visit, InventoryItem } from '@/types'

interface DashboardChartsProps {
  appointments: Appointment[]
  visits: Visit[]
  inventory: InventoryItem[]
}

export default function DashboardCharts({
  appointments,
  visits,
  inventory,
}: DashboardChartsProps) {
  // Generate appointment trends
  const appointmentTrends = useMemo(() => {
    const last7Days = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().split('T')[0]
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
      const count = appointments.filter((a) => a.date === dateStr).length
      last7Days.push({ day: dayName, count, date: dateStr })
    }
    return last7Days
  }, [appointments])

  // Generate revenue trends
  const revenueTrends = useMemo(() => {
    const last7Days = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().split('T')[0]
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
      const revenue = visits
        .filter((v) => {
          const visitDate = new Date(v.startTime || new Date())
            .toISOString()
            .split('T')[0]
          return visitDate === dateStr
        })
        .reduce((sum, v) => sum + (v.totalBill || 0), 0)
      last7Days.push({ day: dayName, revenue: revenue / 1000, date: dateStr })
    }
    return last7Days
  }, [visits])

  // Generate inventory status pie chart
  const inventoryStatus = useMemo(() => {
    const inStock = inventory.filter(
      (i) => i.stock > i.minStockLevel
    ).length
    const lowStock = inventory.filter(
      (i) => i.stock <= i.minStockLevel && i.stock > 0
    ).length
    const outOfStock = inventory.filter((i) => i.stock === 0).length

    return [
      { name: 'In Stock', value: inStock, color: '#10B981' },
      { name: 'Low Stock', value: lowStock, color: '#F59E0B' },
      { name: 'Out of Stock', value: outOfStock, color: '#EF4444' },
    ].filter((item) => item.value > 0)
  }, [inventory])

  // Generate visit completion status
  const visitStatus = useMemo(() => {
    const completed = visits.filter((v) => v.stage === 'Completed').length
    const inProgress = visits.filter((v) => v.stage !== 'Completed').length

    return [
      { name: 'Completed', value: completed, color: '#10B981' },
      { name: 'In Progress', value: inProgress, color: '#3B82F6' },
    ].filter((item) => item.value > 0)
  }, [visits])

  // Top appointment reasons
  const topReasons = useMemo(() => {
    const reasonCounts: { [key: string]: number } = {}
    appointments.forEach((a) => {
      reasonCounts[a.reason] = (reasonCounts[a.reason] || 0) + 1
    })
    return Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [appointments])

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Appointments Trend */}
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
              labelStyle={{ color: '#f1f5f9' }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#3B82F6"
              dot={{ fill: '#3B82F6', r: 5 }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue Trend */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Revenue Trend (Last 7 Days)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={revenueTrends}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="day" stroke="#64748b" />
            <YAxis stroke="#64748b" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#f1f5f9' }}
              formatter={(value: any) => `KSh ${Number(value ?? 0).toFixed(1)}K`}
            />
            <Bar dataKey="revenue" fill="#10B981" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Inventory Status */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Inventory Status
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={inventoryStatus}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name} (${value})`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {inventoryStatus.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#f1f5f9' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Visit Completion Status */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Visit Completion Status
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={visitStatus}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name} (${value})`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {visitStatus.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#f1f5f9' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Top Appointment Reasons */}
      {topReasons.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Top Appointment Reasons
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topReasons}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="reason" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#f1f5f9' }}
              />
              <Bar dataKey="count" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

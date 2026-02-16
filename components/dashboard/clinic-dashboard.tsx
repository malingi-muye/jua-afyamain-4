"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { getSupabaseClient } from "@/lib/supabase/singleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Users, Calendar, DollarSign, TrendingUp, AlertCircle } from "lucide-react"
import type { Clinic } from "@/types/database"

interface DashboardStats {
  totalPatients: number
  todayAppointments: number
  revenue: number
  pendingQueue: number
}

export function ClinicDashboard({ clinic }: { clinic: Clinic }) {
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    todayAppointments: 0,
    revenue: 0,
    pendingQueue: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const supabase = getSupabaseClient()

        // Get total patients
        const { count: patientCount } = await supabase
          .from("patients")
          .select("*", { count: "exact" })
          .eq("clinic_id", clinic.id)

        // Get today's appointments
        const today = new Date().toISOString().split("T")[0]
        const { count: appointmentCount } = await supabase
          .from("appointments")
          .select("*", { count: "exact" })
          .eq("clinic_id", clinic.id)
          .gte("appointment_date", today)

        // Get pending visits (queue)
        const { count: queueCount } = await supabase
          .from("visits")
          .select("*", { count: "exact" })
          .eq("clinic_id", clinic.id)
          .in("stage", ["check-in", "vitals", "consultation"])

        setStats({
          totalPatients: patientCount || 0,
          todayAppointments: appointmentCount || 0,
          revenue: 45230, // Mock data
          pendingQueue: queueCount || 0,
        })
      } catch (error) {
        console.error("[v0] Error fetching stats:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [clinic.id])

  if (isLoading) {
    return <Spinner />
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-slate-600 dark:text-slate-400">Welcome back to {clinic.name}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Patients" value={stats.totalPatients} icon={Users} color="blue" />
        <StatCard title="Today's Appointments" value={stats.todayAppointments} icon={Calendar} color="green" />
        <StatCard
          title="Revenue Today"
          value={`${clinic.currency} ${stats.revenue.toLocaleString()}`}
          icon={DollarSign}
          color="emerald"
        />
        <StatCard
          title="In Queue"
          value={stats.pendingQueue}
          icon={AlertCircle}
          color={stats.pendingQueue > 0 ? "orange" : "slate"}
        />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">Patient {i}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{i * 2}:00 PM - Consultation</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                    Scheduled
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">Occupancy Rate</p>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: "75%" }} />
              </div>
              <p className="text-xs text-slate-500">75%</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">Avg Wait Time</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">12 min</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

interface StatCardProps {
  title: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  color: "blue" | "green" | "emerald" | "orange" | "slate"
}

function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
  const colorClasses = {
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    green: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    emerald: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
    orange: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
    slate: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{title}</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{value}</p>
          </div>
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

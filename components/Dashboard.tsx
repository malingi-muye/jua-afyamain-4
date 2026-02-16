"use client"

import React from "react"
import { useState, useMemo, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import type { ViewState } from "../types"
import {
  Users,
  Calendar,
  Activity,
  Search,
  Bell,
  ChevronDown,
  MoreHorizontal,
  Sparkles,
  LogOut,
  Settings,
  User,
  CheckCircle,
  Download,
  FileText,
  Share2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Pill,
  X,
} from "lucide-react"
import { AIBriefingCard } from "./dashboard/AIBriefingCard"
const DashboardCharts = React.lazy(() => import("./dashboard/DashboardCharts").then(m => ({ default: m.DashboardCharts })))
import { Suspense } from 'react'
import useStore from "../store"
import { getAvatarUrl } from "../lib/utils"

const Dashboard: React.FC = () => {
  const navigate = useNavigate()

  // Granular selectors: only re-render if the specific array/object changes
  const appointments = useStore(state => state.appointments)
  const patients = useStore(state => state.patients)
  const inventory = useStore(state => state.inventory)
  const visits = useStore(state => state.visits)
  const actions = useStore(state => state.actions)
  const currentUser = useStore(state => state.currentUser)

  const { setCurrentView, logout } = actions

  // Redirect SuperAdmin to their specific dashboard
  useEffect(() => {
    const role = currentUser?.role?.toString().toLowerCase()
    if (role === "superadmin" || role === "super_admin") {
      actions.setCurrentView("sa-overview")
    }
  }, [currentUser, actions])

  const [searchTerm, setSearchTerm] = useState("")
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // Dropdown States
  const [timeRange, setTimeRange] = useState("Month")
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false)
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  const [systemNotifications, setSystemNotifications] = useState<any[]>([])

  // Dashboard Stats Memoized
  const dashboardStats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0]
    return {
      todayPatients: visits.filter(v => v.startTime.startsWith(today)).length,
      todayAppointments: appointments.filter(a => a.date === today).length,
      todayApptsScheduled: appointments.filter(a => a.date === today && a.status === "Scheduled").length,
      completedVisits: visits.filter(v => v.stage === "Completed" && v.startTime.startsWith(today)).length,
      pendingVisitsCount: visits.filter(v => v.stage !== "Completed").length,
      lowStockCount: inventory.filter(i => i.stock <= i.minStockLevel).length,
      todayRevenue: visits.filter(v => v.startTime.startsWith(today)).reduce((acc, v) => acc + (v.totalBill || 0), 0)
    }
  }, [inventory, visits, appointments])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      if (logout) {
        await logout()
      }
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  useEffect(() => {
    const msgs: any[] = []

    // Check Low Stock
    if (dashboardStats.lowStockCount > 0) {
      msgs.push({
        id: "stock-alert",
        text: `Low stock alert: ${dashboardStats.lowStockCount} items below threshold`,
        type: "alert",
        time: "Now",
        read: false,
      })
    }

    // Check pending visits
    if (dashboardStats.pendingVisitsCount > 0) {
      msgs.push({
        id: "visits-pending",
        text: `${dashboardStats.pendingVisitsCount} patients in queue today`,
        type: "info",
        time: "Now",
        read: false,
      })
    }

    // Today's appointments
    if (dashboardStats.todayApptsScheduled > 0) {
      msgs.push({
        id: "appts-today",
        text: `${dashboardStats.todayApptsScheduled} appointments scheduled for today`,
        type: "success",
        time: "Today",
        read: true,
      })
    }

    setSystemNotifications(msgs)
  }, [dashboardStats])

  const unreadCount = systemNotifications.filter((n) => !n.read).length

  // Calendar State
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0])

  // Dynamic Data Generators based on TimeRange and real data
  const getStatsByRange = useMemo(() => {
    const totalPatients = patients.length
    const totalAppts = appointments.length
    const newPatients = patients.filter((p) => {
      const lastVisit = new Date(p.lastVisit)
      const daysAgo = (Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24)
      return daysAgo <= 30
    }).length

    return {
      total: totalPatients,
      old: patients.filter(p => (p.history?.length || 0) > 1).length,
      new: newPatients,
      appt: totalAppts,
      chartData: (() => {
        if (patients.length === 0 && appointments.length === 0 && visits.length === 0) return []

        if (timeRange === "Daily") {
          const slots = ["8am", "10am", "12pm", "2pm", "4pm"]
          return slots.map(s => ({
            name: s,
            val: appointments.filter(a => a.time.toLowerCase().includes(s)).length
          }))
        }

        if (timeRange === "Weekly") {
          const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
          return days.map(day => ({
            name: day,
            val: visits.filter(v => {
              try {
                return new Date(v.startTime).toLocaleDateString('en-US', { weekday: 'short' }) === day
              } catch (e) { return false }
            }).length
          }))
        }

        if (timeRange === "Yearly") {
          const months = ["Jan", "Apr", "Jul", "Oct"]
          return months.map(m => ({
            name: m,
            val: visits.filter(v => {
              try {
                return new Date(v.startTime).toLocaleDateString('en-US', { month: 'short' }) === m
              } catch (e) { return false }
            }).length
          }))
        }

        // Monthly / Default fallback
        return [
          { name: "Week 1", val: visits.length },
          { name: "Week 2", val: 0 },
          { name: "Week 3", val: 0 },
          { name: "Week 4", val: 0 },
        ]
      })(),
    }
  }, [timeRange, patients, appointments, visits])

  const currentStats = getStatsByRange

  const dailyBarStats = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const stats = days.map(day => ({ name: day, val: 0 }))

    visits.forEach(v => {
      const date = new Date(v.startTime)
      const dayName = days[date.getDay()]
      const found = stats.find(s => s.name === dayName)
      if (found) found.val++
    })

    // Sort to start from current day - 6
    const todayIndex = new Date().getDay()
    const sortedStats = []
    for (let i = 0; i < 7; i++) {
      sortedStats.push(stats[(todayIndex - 6 + i + 7) % 7])
    }
    return sortedStats
  }, [visits])

  // Real patient demographics
  const pieData = useMemo(() => {
    const ageGroups = { Child: 0, Teen: 0, Adult: 0, Senior: 0 }
    patients.forEach((p) => {
      if (p.age < 13) ageGroups.Child++
      else if (p.age < 20) ageGroups.Teen++
      else if (p.age < 60) ageGroups.Adult++
      else ageGroups.Senior++
    })
    const data = [
      { name: "Child", value: ageGroups.Child, color: "#F59E0B" },
      { name: "Adult", value: ageGroups.Adult, color: "#10B981" },
      { name: "Teen", value: ageGroups.Teen, color: "#0F766E" },
      { name: "Senior", value: ageGroups.Senior, color: "#EC4899" },
    ]
    return patients.length > 0 ? data : data.map(d => ({ ...d, value: 0 }))
  }, [patients])

  // Filter appointments based on selected day
  const filteredAppointments = appointments.filter((appt) => {
    return appt.date === selectedDate && appt.status === "Scheduled"
  })

  // Calendar Generator
  const generateCalendarDays = () => {
    const today = new Date()
    const days = []
    for (let i = -2; i < 3; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      days.push({
        date: d.getDate(),
        day: d.toLocaleString("default", { weekday: "short" }),
        fullDate: d.toISOString().split("T")[0],
      })
    }
    return days
  }

  const calendarDays = generateCalendarDays()

  const markAllRead = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSystemNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const filteredPatients = patients.filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()))

  // Toggle Context Menus
  const toggleMenu = (e: React.MouseEvent, menuId: string) => {
    e.stopPropagation()
    setActiveMenuId(activeMenuId === menuId ? null : menuId)
    setIsTimeDropdownOpen(false)
    setIsNotifOpen(false)
    setIsProfileOpen(false)
  }

  // Export chart data
  const handleExportChart = (chartName: string) => {
    const data = chartName === "daily" ? dailyBarStats : currentStats.chartData
    const csv = [Object.keys(data[0]).join(","), ...data.map((row) => Object.values(row).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${chartName}_stats_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
    setActiveMenuId(null)
  }

  return (
    <div
      className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-5 md:space-y-6 pb-20 sm:pb-24 md:pb-8 max-w-[1600px] mx-auto bg-gray-100 dark:bg-slate-900 min-h-screen transition-colors duration-200"
      onClick={() => {
        setIsTimeDropdownOpen(false)
        setIsNotifOpen(false)
        setIsProfileOpen(false)
        setActiveMenuId(null)
      }}
    >
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4 mb-6 sm:mb-7 md:mb-8 relative z-20">
        <div>
          <h2 className="text-lg sm:text-xl text-slate-500 dark:text-slate-400 font-medium">Welcome back</h2>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white">
            {currentUser?.name?.split(" ")[0] || "User"}
          </h1>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full md:w-auto mt-4 md:mt-0">
          <div className="relative w-full sm:w-64 md:w-80 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-brand-500 transition-colors" />
            <input
              type="text"
              placeholder="Search recent patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-transparent focus:border-brand-200 dark:focus:border-brand-800 rounded-xl shadow-sm focus:ring-4 focus:ring-brand-500/10 dark:text-white text-sm placeholder-slate-400 outline-none transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto">
            {/* Time Range Dropdown */}
            <div className="relative flex-1 sm:flex-none">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsTimeDropdownOpen(!isTimeDropdownOpen)
                  setIsNotifOpen(false)
                  setIsProfileOpen(false)
                  setActiveMenuId(null)
                }}
                className="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-2.5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 transition-all"
              >
                <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                {timeRange}
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${isTimeDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isTimeDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-[60] animate-in fade-in zoom-in-95 duration-100">
                  {["Daily", "Weekly", "Month", "Yearly"].map((item) => (
                    <button
                      key={item}
                      onClick={() => {
                        setTimeRange(item)
                        setIsTimeDropdownOpen(false)
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between ${timeRange === item ? "text-brand-600 font-medium bg-brand-50 dark:bg-brand-900/10" : "text-slate-600 dark:text-slate-300"}`}
                    >
                      {item}
                      {timeRange === item && <CheckCircle className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsNotifOpen(!isNotifOpen)
                  setIsTimeDropdownOpen(false)
                  setIsProfileOpen(false)
                  setActiveMenuId(null)
                }}
                className={`p-2.5 rounded-full shadow-sm relative transition-all border border-slate-100 dark:border-slate-700 ${isNotifOpen ? "bg-brand-50 text-brand-600 dark:bg-slate-700 dark:text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-800"></span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-[60] animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">Notifications</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {systemNotifications.length > 0 ? (
                      systemNotifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`p-4 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors flex gap-3 ${!notif.read ? "bg-brand-50/30 dark:bg-brand-900/10" : ""}`}
                        >
                          <div
                            className={`mt-1 w-2 h-2 rounded-full shrink-0 ${notif.type === "alert" ? "bg-red-500" : notif.type === "success" ? "bg-green-500" : "bg-blue-500"}`}
                          ></div>
                          <div>
                            <p className="text-sm text-slate-700 dark:text-slate-200 font-medium">{notif.text}</p>
                            <p className="text-xs text-slate-400 mt-1">{notif.time}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-400">No notifications</div>
                    )}
                  </div>
                  <div className="p-2 text-center bg-slate-50 dark:bg-slate-700/30">
                    <button
                      onClick={() => setCurrentView("reports" as ViewState)}
                      className="text-xs font-medium text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                    >
                      View All Activity
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsProfileOpen(!isProfileOpen)
                  setIsTimeDropdownOpen(false)
                  setIsNotifOpen(false)
                  setActiveMenuId(null)
                }}
                className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border-2 border-white dark:border-slate-800 shadow-sm focus:ring-2 focus:ring-brand-500 transition-all cursor-pointer"
              >
                <img
                  src={currentUser?.avatar || getAvatarUrl(currentUser?.name || "User")}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </button>

              {isProfileOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-[60] animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                    <p className="font-bold text-slate-900 dark:text-white text-sm">{currentUser?.name || "User"}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{currentUser?.email || ""}</p>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => {
                        navigate("/profile")
                        setIsProfileOpen(false)
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl flex items-center gap-3 transition-colors"
                    >
                      <User className="w-4 h-4 text-indigo-500" /> My Profile
                    </button>
                    <button
                      onClick={() => {
                        navigate("/settings")
                        setIsProfileOpen(false)
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl flex items-center gap-3 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-teal-500" /> Settings
                    </button>
                    <div className="h-px bg-slate-100 dark:bg-slate-700 my-2 mx-2"></div>
                    <button
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="w-full text-left px-3 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl flex items-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards Row - MOBILE RESPONSIVE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6 mb-5 sm:mb-6 md:mb-8">
        <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 md:p-6 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center gap-3 sm:gap-4">
          <div className="p-3 sm:p-3.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex-shrink-0">
            <Users className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 truncate">Total Patients</p>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white">{patients.length}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 md:p-6 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center gap-3 sm:gap-4">
          <div className="p-3 sm:p-3.5 bg-green-50 dark:bg-green-900/20 rounded-xl flex-shrink-0">
            <Calendar className="w-6 h-6 sm:w-7 sm:h-7 text-green-600 dark:text-green-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 truncate">Upcoming Appts</p>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white">
              {appointments.filter((a) => a.status === "Scheduled").length}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 md:p-6 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center gap-3 sm:gap-4">
          <div className="p-3 sm:p-3.5 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex-shrink-0">
            <Activity className="w-6 h-6 sm:w-7 sm:h-7 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 truncate">In Queue</p>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white">
              {visits.filter((v) => v.stage !== "Completed").length}
            </p>
          </div>
        </div>

        <div
          className={`bg-white dark:bg-slate-800 p-4 sm:p-5 md:p-6 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center gap-3 sm:gap-4`}
        >
          <div
            className={`p-3 sm:p-3.5 rounded-xl flex-shrink-0 ${dashboardStats.lowStockCount > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-teal-50 dark:bg-teal-900/20"}`}
          >
            <Pill
              className={`w-6 h-6 sm:w-7 sm:h-7 ${dashboardStats.lowStockCount > 0 ? "text-red-600 dark:text-red-400" : "text-teal-600 dark:text-teal-400"}`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 truncate">Low Stock Items</p>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white">
              {dashboardStats.lowStockCount}
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid Layout - MOBILE RESPONSIVE */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6 lg:gap-8 relative z-10">
        {/* Left Column (Stats & Main Charts) */}
        <div className="lg:col-span-3 space-y-3 md:space-y-4 lg:space-y-6">
          {/* Stats Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
            {/* Card 1: Total Patients */}
            <div
              onClick={() => setCurrentView("patients" as ViewState)}
              className="bg-blue-100 dark:bg-blue-900/40 p-3 sm:p-4 md:p-6 rounded-3xl flex flex-col justify-between h-32 sm:h-40 relative overflow-hidden group border border-transparent dark:border-blue-900/50 transition-all hover:shadow-lg hover:-translate-y-1 duration-300 cursor-pointer"
            >
              <div className="absolute top-3 right-3 p-1.5 sm:p-2 bg-white/50 dark:bg-white/10 rounded-full backdrop-blur-sm">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <p className="text-slate-600 dark:text-slate-300 font-medium text-xs sm:text-sm mt-6 sm:mt-8">
                  Total Patients
                </p>
                <div className="flex items-end gap-1 sm:gap-2">
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white animate-in slide-in-from-bottom-2 fade-in">
                    {currentStats.total}
                  </h3>
                  {currentStats.total > 0 && (
                    <span className="text-xs font-semibold bg-white/50 dark:bg-white/10 px-1 py-0.5 rounded text-green-700 dark:text-green-300 mb-0.5 flex items-center gap-0.5">
                      <TrendingUp className="w-2 h-2 sm:w-3 sm:h-3" /> 10%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Card 2: Old Patients */}
            <div className="bg-pink-100 dark:bg-pink-900/40 p-3 sm:p-4 md:p-6 rounded-3xl flex flex-col justify-between h-32 sm:h-40 relative overflow-hidden border border-transparent dark:border-pink-900/50 transition-all hover:shadow-lg hover:-translate-y-1 duration-300">
              <div className="absolute top-3 right-3 p-1.5 sm:p-2 bg-white/50 dark:bg-white/10 rounded-full backdrop-blur-sm">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-pink-600 dark:text-pink-300" />
              </div>
              <div>
                <p className="text-slate-600 dark:text-slate-300 font-medium text-xs sm:text-sm mt-6 sm:mt-8">
                  Returning
                </p>
                <div className="flex items-end gap-1 sm:gap-2">
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white animate-in slide-in-from-bottom-2 fade-in">
                    {currentStats.old}
                  </h3>
                  {currentStats.old > 0 && (
                    <span className="text-xs font-semibold bg-white/50 dark:bg-white/10 px-1 py-0.5 rounded text-red-600 dark:text-red-300 mb-0.5 flex items-center gap-0.5">
                      <TrendingDown className="w-2 h-2 sm:w-3 sm:h-3" /> 15%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Card 3: New Patients */}
            <div className="bg-green-100 dark:bg-emerald-900/40 p-3 sm:p-4 md:p-6 rounded-3xl flex flex-col justify-between h-32 sm:h-40 relative overflow-hidden border border-transparent dark:border-emerald-900/50 transition-all hover:shadow-lg hover:-translate-y-1 duration-300">
              <div className="absolute top-3 right-3 p-1.5 sm:p-2 bg-white/50 dark:bg-white/10 rounded-full backdrop-blur-sm">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-300" />
              </div>
              <div>
                <p className="text-slate-600 dark:text-slate-300 font-medium text-xs sm:text-sm mt-6 sm:mt-8">
                  New Patients
                </p>
                <div className="flex items-end gap-1 sm:gap-2">
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white animate-in slide-in-from-bottom-2 fade-in">
                    {currentStats.new}
                  </h3>
                  {currentStats.new > 0 && (
                    <span className="text-xs font-semibold bg-white/50 dark:bg-white/10 px-1 py-0.5 rounded text-green-700 dark:text-green-300 mb-0.5 flex items-center gap-0.5">
                      <TrendingUp className="w-2 h-2 sm:w-3 sm:h-3" /> 24%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Card 4: Appointments */}
            <div
              onClick={() => setCurrentView("appointments" as ViewState)}
              className="bg-orange-100 dark:bg-orange-900/40 p-3 sm:p-4 md:p-6 rounded-3xl flex flex-col justify-between h-32 sm:h-40 relative overflow-hidden border border-transparent dark:border-orange-900/50 transition-all hover:shadow-lg hover:-translate-y-1 duration-300 cursor-pointer"
            >
              <div className="absolute top-3 right-3 p-1.5 sm:p-2 bg-white/50 dark:bg-white/10 rounded-full backdrop-blur-sm">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 dark:text-orange-300" />
              </div>
              <div>
                <p className="text-slate-600 dark:text-slate-300 font-medium text-xs sm:text-sm mt-6 sm:mt-8">
                  Appointments
                </p>
                <div className="flex items-end gap-1 sm:gap-2">
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white animate-in slide-in-from-bottom-2 fade-in">
                    {currentStats.appt}
                  </h3>
                  {currentStats.appt > 0 && (
                    <span className="text-xs font-semibold bg-white/50 dark:bg-white/10 px-1 py-0.5 rounded text-green-700 dark:text-green-300 mb-0.5 flex items-center gap-0.5">
                      <TrendingUp className="w-2 h-2 sm:w-3 sm:h-3" /> 10%
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row - MOBILE RESPONSIVE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 lg:gap-6">
            {/* Daily Appointment Stats */}
            <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-x-auto md:overflow-visible">
              <div className="flex justify-between items-center mb-4 md:mb-6 min-w-[280px] sm:min-w-[400px]">
                <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg">Daily Appointment Stats</h3>
                <div className="relative">
                  <MoreHorizontal
                    onClick={(e) => toggleMenu(e, "dailyStats")}
                    className="text-slate-400 w-5 h-5 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200"
                  />
                </div>
              </div>
              <div className="h-48 sm:h-52 md:h-48 w-full min-h-[180px] sm:min-h-[192px] min-w-[280px] sm:min-w-[300px]">
                <Suspense fallback={<div className="h-48 flex items-center justify-center text-slate-400 text-xs">Loading Daily Stats...</div>}>
                  <DashboardCharts data={dailyBarStats} type="bar" />
                </Suspense>
              </div>
            </div>

            {/* Appointment Stats (Curve) */}
            <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-x-auto md:overflow-visible">
              <div className="flex justify-between items-center mb-4 md:mb-6 min-w-[280px] sm:min-w-[400px]">
                <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg">Appointment Stats</h3>
                <div className="relative">
                  <MoreHorizontal
                    onClick={(e) => toggleMenu(e, "curveStats")}
                    className="text-slate-400 w-5 h-5 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200"
                  />
                  {activeMenuId === "curveStats" && (
                    <div className="absolute right-0 top-6 w-36 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-[60] animate-in fade-in zoom-in-95 duration-100">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.href)
                          setActiveMenuId(null)
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                      >
                        <Share2 className="w-3 h-3" /> Share
                      </button>
                      <button
                        onClick={() => handleExportChart("appointment")}
                        className="w-full text-left px-4 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                      >
                        <Download className="w-3 h-3" /> Download
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="h-48 sm:h-52 md:h-48 w-full min-h-[180px] sm:min-h-[192px] min-w-[280px] sm:min-w-[300px]">
                <Suspense fallback={<div className="h-48 flex items-center justify-center text-slate-400 text-xs">Loading Area Chart...</div>}>
                  <DashboardCharts data={currentStats.chartData} type="area" />
                </Suspense>
              </div>
            </div>
          </div>

          {/* Patients Table Preview */}
          <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 w-full">
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <h3 className="font-bold text-slate-900 dark:text-white">Recent Patients</h3>
              <button
                onClick={() => setCurrentView("patients" as ViewState)}
                className="text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400"
              >
                View All
              </button>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left min-w-[600px]">
                <thead className="bg-gray-50 dark:bg-slate-700/50 text-xs uppercase text-slate-400 font-semibold">
                  <tr>
                    <th className="px-4 py-3 rounded-l-xl">Name</th>
                    <th className="px-4 py-3">Age</th>
                    <th className="px-4 py-3">Last Visit</th>
                    <th className="px-4 py-3">Gender</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 rounded-r-xl">Action</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {filteredPatients.slice(0, 5).map((patient) => (
                    <tr
                      key={patient.id}
                      className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center overflow-hidden shrink-0 font-bold text-xs text-slate-500">
                            <img
                              src={getAvatarUrl(patient.name)}
                              alt="avatar"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <span className="font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                            {patient.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-500 dark:text-slate-400">{patient.age} years</td>
                      <td className="px-4 py-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {patient.lastVisit}
                      </td>
                      <td className="px-4 py-4">
                        <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
                          {patient.gender}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <CheckCircle className="w-3 h-3" />
                          <span className="text-xs">Active</span>
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => setCurrentView("patients" as ViewState)}
                          className="text-teal-600 dark:text-teal-400 hover:underline text-sm font-medium"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredPatients.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No patients found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4 sm:space-y-5 md:space-y-6">
          <AIBriefingCard stats={dashboardStats} />

          {/* Patient Overview Donut */}
          <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 relative">
            <div className="flex justify-between items-center mb-4 md:mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white">Patient Overview</h3>
              <div className="relative">
                <MoreHorizontal
                  onClick={(e) => toggleMenu(e, "donutStats")}
                  className="text-slate-400 w-5 h-5 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200"
                />
                {activeMenuId === "donutStats" && (
                  <div className="absolute right-0 top-6 w-36 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-[60] animate-in fade-in zoom-in-95 duration-100">
                    <button
                      onClick={() => {
                        setCurrentView("reports" as ViewState)
                        setActiveMenuId(null)
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                    >
                      <FileText className="w-3 h-3" /> View Details
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="h-48 relative w-full min-h-[192px]">
              <Suspense fallback={<div className="h-48 flex items-center justify-center text-slate-400 text-xs">Loading Overview...</div>}>
                <DashboardCharts
                  data={pieData.map(d => ({ ...d, val: d.value }))}
                  type="pie"
                  colors={pieData.map(d => d.color)}
                />
              </Suspense>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-slate-800 dark:text-white">{patients.length}</span>
                <span className="text-xs text-slate-400 uppercase">Total</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-2">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {d.name} ({d.value})
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Appointments */}
          <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-3xl shadow-sm h-auto border border-slate-100 dark:border-slate-700">
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <h3 className="font-bold text-slate-900 dark:text-white">Upcoming</h3>
              <button
                onClick={() => setCurrentView("appointments" as ViewState)}
                className="text-xs text-teal-600 hover:underline font-medium"
              >
                View All
              </button>
            </div>

            {/* Simulated Calendar Strip */}
            <div className="flex justify-between mb-4 md:mb-6 bg-slate-50 dark:bg-slate-700 p-1.5 sm:p-2 rounded-xl">
              {calendarDays.map((d, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedDate(d.fullDate)}
                  className={`flex flex-col items-center p-1.5 sm:p-2 rounded-lg transition-all text-xs font-bold ${selectedDate === d.fullDate
                    ? "bg-teal-600 text-white shadow-md scale-105"
                    : "text-slate-400 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 hover:shadow-sm"
                    }`}
                >
                  <span className="text-[10px] uppercase">{d.day}</span>
                  <span>{d.date}</span>
                </button>
              ))}
            </div>

            <div className="space-y-3 md:space-y-4">
              {filteredAppointments.length > 0 ? (
                filteredAppointments.slice(0, 4).map((appt) => (
                  <div
                    key={appt.id}
                    className="flex items-center gap-3 p-2.5 md:p-3 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer group"
                  >
                    <img
                      src={getAvatarUrl(appt.patientName)}
                      className="w-10 h-10 rounded-full bg-slate-200"
                      alt="patient"
                    />
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                        {appt.patientName}
                      </h4>
                      <p className="text-xs text-slate-400">{appt.time}</p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-1 rounded ${appt.status === "Scheduled"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                        }`}
                    >
                      {appt.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-slate-400 text-xs">No appointments for this day.</div>
              )}
            </div>
          </div>

          {/* Low Stock Alert */}
          {inventory.filter((i) => i.stock <= i.minStockLevel).length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl border border-red-100 dark:border-red-900/30">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-red-800 dark:text-red-300 text-sm">Low Stock Alert</h4>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {inventory.filter((i) => i.stock <= i.minStockLevel).length} items need restocking
                  </p>
                  <button
                    onClick={() => setCurrentView("pharmacy" as ViewState)}
                    className="mt-2 text-xs font-bold text-red-700 dark:text-red-300 hover:underline"
                  >
                    View Pharmacy
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard


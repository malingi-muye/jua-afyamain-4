"use client"

import type React from "react"
import { useState, useMemo } from "react"
import type { Appointment, Patient } from "../types"
import {
  Calendar,
  Clock,
  Check,
  X,
  MoreHorizontal,
  Search,
  Plus,
  Filter,
  Phone,
  ChevronDown,
  Download,
  Printer,
  Edit2,
  UserPlus,
} from "lucide-react"
import useStore from '../store'
import { hasPermission } from '../lib/permissions'
import { canCurrentUser } from '../lib/roleMapper'
import type { UserRole } from '../types/enterprise'

interface AppointmentsProps {
  appointments: Appointment[]
  patients: Patient[]
  addAppointment: (appt: Appointment) => void
  updateAppointment: (appt: Appointment) => void
  showToast: (msg: string, type?: "success" | "error" | "info") => void
}

const Appointments: React.FC<AppointmentsProps> = ({
  appointments,
  patients,
  addAppointment,
  updateAppointment,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<"upcoming" | "completed" | "cancelled">("upcoming")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all")
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)

  // New Appointment State
  const [newApptData, setNewApptData] = useState({
    patientId: "",
    date: new Date().toISOString().split("T")[0],
    time: "09:00",
    reason: "",
  })

  // Filter appointments by tab, search, and date
  const filteredAppointments = useMemo(() => {
    let filtered = appointments.filter((appt) => {
      if (activeTab === "upcoming") return appt.status === "Scheduled"
      if (activeTab === "completed") return appt.status === "Completed"
      return appt.status === "Cancelled"
    })

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (appt) =>
          appt.patientName.toLowerCase().includes(term) ||
          appt.reason.toLowerCase().includes(term) ||
          appt.date.includes(term),
      )
    }

    // Date filter
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (dateFilter === "today") {
      const todayStr = today.toISOString().split("T")[0]
      filtered = filtered.filter((appt) => appt.date === todayStr)
    } else if (dateFilter === "week") {
      const weekLater = new Date(today)
      weekLater.setDate(weekLater.getDate() + 7)
      filtered = filtered.filter((appt) => {
        const apptDate = new Date(appt.date)
        return apptDate >= today && apptDate <= weekLater
      })
    } else if (dateFilter === "month") {
      const monthLater = new Date(today)
      monthLater.setMonth(monthLater.getMonth() + 1)
      filtered = filtered.filter((appt) => {
        const apptDate = new Date(appt.date)
        return apptDate >= today && apptDate <= monthLater
      })
    }

    // Sort by date and time
    filtered.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      return a.time.localeCompare(b.time)
    })

    return filtered
  }, [appointments, activeTab, searchTerm, dateFilter])

  const { currentUser } = useStore()
  const canExport = canCurrentUser('reports.export')
  const canCreate = canCurrentUser('appointments.create')

  const handleStatusChange = (appt: Appointment, newStatus: "Scheduled" | "Completed" | "Cancelled") => {
    if (newStatus === "Completed" && !canCurrentUser('visits.complete')) {
      try { useStore.getState().actions.showToast('You are not authorized to complete visits.', 'error') } catch (e) { alert('You are not authorized to complete visits.') }
      return
    }

    updateAppointment({ ...appt, status: newStatus })
    showToast(
      `Appointment ${newStatus.toLowerCase()}`,
      newStatus === "Completed" ? "success" : newStatus === "Cancelled" ? "info" : "success",
    )
    setActionMenuId(null)
  }

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault()
    const patient = patients.find((p) => p.id === newApptData.patientId)
    if (!patient || !newApptData.date || !newApptData.time) {
      showToast("Please fill all required fields", "error")
      return
    }

    // Check for conflicts
    const conflict = appointments.find(
      (a) => a.date === newApptData.date && a.time === newApptData.time && a.status === "Scheduled",
    )

    if (conflict) {
      showToast(`Conflict: Appointment exists at ${newApptData.time} on ${newApptData.date}`, "error")
      return
    }

    const newAppointment: Appointment = {
      id: `A${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      date: newApptData.date,
      time: newApptData.time,
      reason: newApptData.reason || "General Checkup",
      status: "Scheduled",
    }

    addAppointment(newAppointment)
    showToast(`Appointment scheduled for ${patient.name}`, "success")
    setIsModalOpen(false)
    setNewApptData({ patientId: "", date: new Date().toISOString().split("T")[0], time: "09:00", reason: "" })
  }

  const handleEditAppointment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAppt) return

    const patient = patients.find((p) => p.id === newApptData.patientId)
    if (!patient) return

    updateAppointment({
      ...selectedAppt,
      patientId: newApptData.patientId,
      patientName: patient.name,
      date: newApptData.date,
      time: newApptData.time,
      reason: newApptData.reason,
    })

    showToast("Appointment updated", "success")
    setIsModalOpen(false)
    setIsEditMode(false)
    setSelectedAppt(null)
    setNewApptData({ patientId: "", date: new Date().toISOString().split("T")[0], time: "09:00", reason: "" })
  }

  const openEditModal = (appt: Appointment) => {
    setSelectedAppt(appt)
    setNewApptData({
      patientId: appt.patientId,
      date: appt.date,
      time: appt.time,
      reason: appt.reason,
    })
    setIsEditMode(true)
    setIsModalOpen(true)
    setActionMenuId(null)
  }

  const handleExportCSV = () => {
    const headers = ["ID", "Patient", "Date", "Time", "Reason", "Status"]
    const rows = filteredAppointments.map((appt) =>
      [appt.id, appt.patientName, appt.date, appt.time, appt.reason, appt.status].join(","),
    )
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `appointments_${activeTab}_${new Date().toISOString().split("T")[0]}.csv`)
    link.click()
    showToast("Appointments exported", "success")
  }

  const tabCounts = useMemo(
    () => ({
      upcoming: appointments.filter((a) => a.status === "Scheduled").length,
      completed: appointments.filter((a) => a.status === "Completed").length,
      cancelled: appointments.filter((a) => a.status === "Cancelled").length,
    }),
    [appointments],
  )

  return (
    <div
      className="p-3 sm:p-5 md:p-8 bg-gray-50 dark:bg-slate-900 min-h-screen transition-colors duration-200"
      onClick={() => {
        setIsFilterOpen(false)
        setActionMenuId(null)
      }}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div className="text-center md:text-left">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Appointments</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm sm:text-base">Manage your schedule and patient visits</p>
        </div>

        <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 sm:gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-500 w-full sm:w-48 md:w-64 dark:text-white"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdown */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsFilterOpen(!isFilterOpen)
              }}
              className={`flex items-center gap-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium ${dateFilter !== "all" ? "ring-2 ring-teal-500" : ""}`}
            >
              <Filter className="w-4 h-4" />
              {dateFilter === "all"
                ? "All Dates"
                : dateFilter === "today"
                  ? "Today"
                  : dateFilter === "week"
                    ? "This Week"
                    : "This Month"}
              <ChevronDown className={`w-4 h-4 transition-transform ${isFilterOpen ? "rotate-180" : ""}`} />
            </button>

            {isFilterOpen && (
              <div className="absolute top-full right-0 mt-2 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-20 animate-in fade-in zoom-in-95">
                {[
                  { value: "all", label: "All Dates" },
                  { value: "today", label: "Today" },
                  { value: "week", label: "This Week" },
                  { value: "month", label: "This Month" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setDateFilter(option.value as any)
                      setIsFilterOpen(false)
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 first:rounded-t-xl last:rounded-b-xl transition-colors ${dateFilter === option.value ? "text-teal-600 font-medium bg-teal-50 dark:bg-teal-900/20" : "text-slate-600 dark:text-slate-300"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export Button */}
          <button
            onClick={() => {
              if (!canExport) {
                useStore.getState().actions.showToast('You do not have permission to export reports.', 'error')
                return
              }
              handleExportCSV()
            }}
            aria-disabled={!canExport}
            disabled={!canExport}
            className={`p-2.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 ${canExport ? 'hover:bg-slate-50 dark:hover:bg-slate-700' : 'opacity-60 cursor-not-allowed'} transition-colors hidden sm:flex`}
            title="Export CSV"
          >
            <Download className="w-5 h-5" />
          </button>

          {/* New Appointment Button */}
          <button
            onClick={() => {
              if (!canCreate) {
                useStore.getState().actions.showToast('You do not have permission to create appointments.', 'error')
                return
              }
              setIsEditMode(false);
              setSelectedAppt(null);
              setNewApptData({ patientId: "", date: new Date().toISOString().split("T")[0], time: "09:00", reason: "" });
              setIsModalOpen(true)
            }}
            aria-disabled={!canCreate}
            disabled={!canCreate}
            className={`bg-slate-900 dark:bg-teal-600 text-white flex items-center gap-2 px-5 py-2.5 rounded-xl ${canCreate ? 'hover:bg-slate-800 dark:hover:bg-teal-700' : 'opacity-60 cursor-not-allowed'} shadow-lg shadow-slate-200 dark:shadow-none font-medium transition-colors`}
          >
            <Plus className="w-5 h-5" />
            <span className="inline">New</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-700 mb-6">
        {(["upcoming", "completed", "cancelled"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-semibold capitalize transition-all relative flex items-center gap-2 ${activeTab === tab
              ? "text-teal-600 dark:text-teal-400"
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
          >
            {tab}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"}`}
            >
              {tabCounts[tab]}
            </span>
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600 dark:bg-teal-400 rounded-t-full"></div>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden transition-colors">
        {filteredAppointments.length > 0 ? (
          <div className="divide-y divide-slate-50 dark:divide-slate-700">
            {filteredAppointments.map((appt) => {
              const patient = patients.find((p) => p.id === appt.patientId)

              return (
                <div
                  key={appt.id}
                  className="p-6 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center justify-center w-14 h-14 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-2xl border border-teal-100 dark:border-teal-800">
                      <span className="text-xs font-bold uppercase">
                        {new Date(appt.date).toLocaleString("default", { month: "short" })}
                      </span>
                      <span className="text-xl font-bold">{new Date(appt.date).getDate()}</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{appt.patientName}</h3>
                      <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 mt-1">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {appt.time}
                        </div>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                        <span>{appt.reason}</span>
                      </div>
                      {patient && (
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {patient.phone}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
                    {appt.status === "Scheduled" && (
                      <>
                        <button
                          onClick={() => {
                            if (!canCurrentUser('patients.create')) {
                              useStore.getState().actions.showToast('Not authorized to check in patients.', 'error');
                              return
                            }
                            useStore.getState().actions.checkInAppointment(appt)
                          }}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-all shadow-lg shadow-teal-100 dark:shadow-none"
                        >
                          <UserPlus className="w-4 h-4" /> Check In
                        </button>
                        <button
                          onClick={() => { if (!canCurrentUser('visits.complete')) { useStore.getState().actions.showToast('Not authorized to complete visits.', 'error'); return } handleStatusChange(appt, "Completed") }}
                          disabled={!canCurrentUser('visits.complete')}
                          aria-disabled={!canCurrentUser('visits.complete')}
                          className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-colors ${canCurrentUser('visits.complete') ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50' : 'text-slate-400 bg-slate-100 cursor-not-allowed opacity-60'}`}
                        >
                          <Check className="w-4 h-4" /> Complete
                        </button>
                        <button
                          onClick={() => { if (!canCurrentUser('appointments.cancel')) { useStore.getState().actions.showToast('Not authorized to cancel appointments.', 'error'); return } handleStatusChange(appt, "Cancelled") }}
                          disabled={!canCurrentUser('appointments.cancel')}
                          aria-disabled={!canCurrentUser('appointments.cancel')}
                          className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-colors ${canCurrentUser('appointments.cancel') ? 'text-slate-600 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600' : 'text-slate-400 bg-slate-100 cursor-not-allowed opacity-60'}`}
                        >
                          <X className="w-4 h-4" /> Cancel
                        </button>
                      </>
                    )}

                    {/* Action Menu */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setActionMenuId(actionMenuId === appt.id ? null : appt.id)
                        }}
                        className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>

                      {actionMenuId === appt.id && (
                        <div className="absolute top-full right-0 mt-1 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-20 animate-in fade-in zoom-in-95">
                          <button
                            onClick={() => openEditModal(appt)}
                            className="w-full text-left px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-t-xl flex items-center gap-2"
                          >
                            <Edit2 className="w-4 h-4" /> Edit
                          </button>
                          {appt.status !== "Scheduled" && (
                            <button
                              onClick={() => handleStatusChange(appt, "Scheduled")}
                              className="w-full text-left px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                            >
                              <Calendar className="w-4 h-4" /> Reschedule
                            </button>
                          )}
                          <button
                            onClick={() => {
                              window.print()
                              setActionMenuId(null)
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-b-xl flex items-center gap-2"
                          >
                            <Printer className="w-4 h-4" /> Print
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white mb-1">No appointments found</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {searchTerm
                ? "Try adjusting your search or filters"
                : `No ${activeTab} appointments. Schedule a new appointment to get started.`}
            </p>
            {!searchTerm && activeTab === "upcoming" && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors"
              >
                Schedule Appointment
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Appointment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
              {isEditMode ? "Edit Appointment" : "Schedule New Appointment"}
            </h3>
            <form onSubmit={isEditMode ? handleEditAppointment : handleCreateAppointment} className="space-y-4">
              <div>
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                  Patient <span className="text-red-500">*</span>
                </label>
                <select
                  value={newApptData.patientId}
                  onChange={(e) => setNewApptData({ ...newApptData, patientId: e.target.value })}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                  required
                >
                  <option value="">Select a patient...</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.name} - {patient.phone}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={newApptData.date}
                    onChange={(e) => setNewApptData({ ...newApptData, date: e.target.value })}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                    Time <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newApptData.time}
                    onChange={(e) => setNewApptData({ ...newApptData, time: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                    required
                  >
                    {Array.from({ length: 20 }, (_, i) => {
                      const hour = Math.floor(i / 2) + 8
                      const min = i % 2 === 0 ? "00" : "30"
                      const time = `${hour.toString().padStart(2, "0")}:${min}`
                      return (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                  Reason for Visit
                </label>
                <input
                  type="text"
                  value={newApptData.reason}
                  onChange={(e) => setNewApptData({ ...newApptData, reason: e.target.value })}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                  placeholder="e.g. General Checkup, Follow-up, Consultation"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setIsEditMode(false)
                    setSelectedAppt(null)
                  }}
                  className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 font-bold text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors"
                >
                  {isEditMode ? "Save Changes" : "Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Appointments

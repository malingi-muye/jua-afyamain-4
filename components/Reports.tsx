"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { BarChart, Bar } from 'recharts'
import {
  Download,
  Calendar,
  ChevronDown,
  TrendingUp,
  DollarSign,
  Users,
  Activity,
  FileText,
  Filter,
  Printer,
  Loader2,
  Sparkles,
  Smartphone,
  Clock,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Banknote,
  ScrollText,
  FileSpreadsheet,
  Package,
} from "lucide-react"
import logger from '../lib/logger'
import { exportService } from "../services/exportService"

type TimeRange = "7D" | "30D" | "3M" | "1Y"
type ReportTab = "financial" | "clinical" | "operational" | "inventory" | "moh"

const COLORS = {
  primary: "#3462EE", // Brand Blue
  secondary: "#EFE347", // Brand Yellow
  danger: "#ef4444",
  success: "#10b981",
  mpesa: "#16a34a",
  cash: "#64748b",
  slate: "#94a3b8",
}

const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>("financial")
  const [timeRange, setTimeRange] = useState<TimeRange>("30D")
  const [isTimeMenuOpen, setIsTimeMenuOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv")
  const [isLoading, setIsLoading] = useState(false)

  // -- Filter State --
  const [tableSearch, setTableSearch] = useState("")
  const [drillDownFilter, setDrillDownFilter] = useState<{ category: string; value: string } | null>(null)

  // -- MOH State --
  const [mohFormType, setMohFormType] = useState<"705A" | "705B">("705A")

  // -- Pagination State --
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // -- Real Data State --
  const [visits, setVisits] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [doctorsMap, setDoctorsMap] = useState<Record<string, string>>({})
  const [patients, setPatients] = useState<any[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [inventoryLogs, setInventoryLogs] = useState<any[]>([])

  // Fetch Data
  useEffect(() => {
    const loadData = async () => {
      // Load doctors mapping
      let currentDoctorsMap: Record<string, string> = {}
      try {
        const { supabase } = await import("../lib/supabaseClient")
        const { data: doctors } = await supabase
          .from("users")
          .select("id, full_name, role")
          .in("role", ["doctor", "admin"])

        if (doctors) {
          const map: Record<string, string> = {}
          doctors.forEach((d: any) => {
            map[d.id] = d.full_name || "Unknown Doctor"
          })
          currentDoctorsMap = map
          setDoctorsMap(map)
        }
      } catch (e) {
        logger.warn("Failed to load doctors:", e)
      }

      setIsLoading(true)
      try {
        // Fetch visits with doctor information
        const { supabase } = await import("../lib/supabaseClient")
        const { data: visitsWithDoctors } = await supabase
          .from("visits")
          .select("*")
          .order("created_at", { ascending: false })

        // Fetch appointments
        const apptsData = await import("../services/db").then((m) => m.db.getAppointments())

        // Fetch patients for demographics
        // Fetch inventory
        const invData = await import("../services/db").then((m) => m.db.getInventory())
        setInventory(invData || [])

        const { data: patientsData } = await supabase
          .from("patients")
          .select("id, name, age, gender")
          .order("created_at", { ascending: false })

        // Fetch inventory logs
        const invLogs = await import("../services/db").then((m) => m.db.getInventoryLogs())
        setInventoryLogs(invLogs || [])

        // Map visits to include doctor name
        const mappedVisits = (visitsWithDoctors || []).map((v: any) => ({
          id: v.id,
          patientId: v.patient_id,
          patientName: v.patient_name || "Unknown",
          doctorId: v.doctor_id,
          doctorName: currentDoctorsMap[v.doctor_id] || "Unknown Doctor",
          stage: v.stage,
          stageStartTime: v.stage_start_time,
          startTime: v.created_at || v.start_time,
          queueNumber: v.queue_number || 0,
          priority: v.priority || "normal",
          vitals: v.vital_signs || {},
          chiefComplaint: v.chief_complaint,
          diagnosis: v.diagnosis,
          doctorNotes: v.doctor_notes,
          labOrders: v.lab_orders || [],
          prescription: v.prescription || [],
          consultationFee: Number(v.consultation_fee) || 0,
          totalBill: Number(v.total_bill) || 0,
          paymentStatus: v.payment_status || "Pending",
          insuranceDetails: v.insurance_details || null,
        }))

        setVisits(mappedVisits)
        setAppointments(apptsData)
        setPatients(patientsData || [])
      } catch (error) {
        console.error("Failed to load report data", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [timeRange])

  // -- Aggregation Logic --

  const filteredVisits = useMemo(() => {
    const now = new Date()
    const limitDate = new Date()
    if (timeRange === "7D") limitDate.setDate(now.getDate() - 7)
    else if (timeRange === "30D") limitDate.setDate(now.getDate() - 30)
    else if (timeRange === "3M") limitDate.setMonth(now.getMonth() - 3)
    else if (timeRange === "1Y") limitDate.setFullYear(now.getFullYear() - 1)

    return visits.filter((v) => new Date(v.startTime) >= limitDate)
  }, [visits, timeRange])

  const financialData = useMemo(() => {
    // Group by Date
    const grouped = filteredVisits.reduce((acc, visit) => {
      const dateKey =
        timeRange === "1Y"
          ? new Date(visit.startTime).toLocaleString("default", { month: "short" })
          : new Date(visit.startTime).toLocaleDateString("en-GB", { day: "numeric", month: "short" })

      if (!acc[dateKey]) acc[dateKey] = { name: dateKey, revenue: 0, expenses: 0 }

      // Revenue = Total Bill
      acc[dateKey].revenue += visit.totalBill || 0
      // Estimated Expenses (e.g. 40% of revenue + fixed cost) - Simulation for now as we don't track expenses
      acc[dateKey].expenses += (visit.totalBill || 0) * 0.4

      return acc
    }, {})

    return Object.values(grouped)
  }, [filteredVisits, timeRange])

  const paymentMethodData = useMemo(() => {
    const insuranceCount = filteredVisits.filter((v) => v.insuranceDetails).length
    const cashCount = filteredVisits.length - insuranceCount
    const total = filteredVisits.length || 1

    return [
      { name: "Insurance", value: Math.round((insuranceCount / total) * 100), color: COLORS.mpesa },
      { name: "Cash", value: Math.round((cashCount / total) * 100), color: COLORS.cash },
    ]
  }, [filteredVisits])

  const diseaseData = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredVisits.forEach((v) => {
      if (v.diagnosis) {
        counts[v.diagnosis] = (counts[v.diagnosis] || 0) + 1
      }
    })

    return Object.entries(counts)
      .map(([name, count], i) => ({
        name,
        count,
        color: [COLORS.primary, COLORS.danger, COLORS.success, COLORS.secondary, COLORS.cash][i % 5],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [filteredVisits])

  const operationalData = useMemo(() => {
    const completed = filteredVisits.filter((v) => v.stage === "Completed").length
    // Appointments status
    const cancelled = appointments.filter((a) => a.status === "Cancelled").length
    const scheduled = appointments.filter((a) => a.status === "Scheduled").length // acts as No Show potential or pending

    return [
      { name: "Completed", value: completed, color: COLORS.success },
      { name: "Cancelled", value: cancelled, color: COLORS.danger },
      { name: "Pending/NoShow", value: scheduled, color: COLORS.cash },
    ]
  }, [filteredVisits, appointments])

  const demographicsData = useMemo(() => {
    // Calculate gender distribution
    const genderCounts = { Male: 0, Female: 0, Other: 0 }
    patients.forEach((p) => {
      const gender = p.gender?.toLowerCase() || "other"
      if (gender === "male" || gender === "m") genderCounts.Male++
      else if (gender === "female" || gender === "f") genderCounts.Female++
      else genderCounts.Other++
    })

    const genderData = [
      { name: "Male", value: genderCounts.Male, color: COLORS.primary },
      { name: "Female", value: genderCounts.Female, color: COLORS.secondary },
      ...(genderCounts.Other > 0 ? [{ name: "Other", value: genderCounts.Other, color: COLORS.slate }] : []),
    ].filter((d) => d.value > 0)

    // Calculate age distribution
    const ageGroups: Record<string, number> = {
      "0-18": 0,
      "19-35": 0,
      "36-50": 0,
      "51-65": 0,
      "65+": 0,
    }

    const today = new Date()
    patients.forEach((p) => {
      if (!p.date_of_birth) return
      const birthDate = new Date(p.date_of_birth)
      const age = today.getFullYear() - birthDate.getFullYear() - (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate()) ? 1 : 0)

      if (age < 0 || age > 150) return
      if (age <= 18) ageGroups["0-18"]++
      else if (age <= 35) ageGroups["19-35"]++
      else if (age <= 50) ageGroups["36-50"]++
      else if (age <= 65) ageGroups["51-65"]++
      else ageGroups["65+"]++
    })

    const ageData = Object.entries(ageGroups)
      .map(([name, count], i) => ({
        name,
        count,
        color: [COLORS.primary, COLORS.secondary, COLORS.success, COLORS.danger, COLORS.slate][i % 5],
      }))
      .filter((d) => d.count > 0)

    return { genderData, ageData }
  }, [patients])

  const mohData = useMemo(() => {
    // 1. Map visits to patient ages
    const visitsWithAge = filteredVisits.map(v => {
      const p = patients.find(pat => pat.id === v.patientId);
      let age = 0;
      if (p?.date_of_birth) {
        const birthDate = new Date(p.date_of_birth)
        const today = new Date()
        age = today.getFullYear() - birthDate.getFullYear() - (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate()) ? 1 : 0)
      }
      return { ...v, age };
    });

    // 2. Filter by Under 5 or Over 5
    const targetVisits = visitsWithAge.filter(v =>
      mohFormType === "705A" ? v.age < 5 : (v.age >= 5 || v.age === 0)
    );

    // 3. Aggregate by Diagnosis
    const counts: Record<string, { newCases: number; reVisits: number; referrals: number }> = {};

    // Some common MOH Code Mapping (Mock/Simplified)
    const mohCodeMap: Record<string, string> = {
      "Malaria": "15",
      "Diarrhoea": "18",
      "Pneumonia": "21",
      "URTI": "22",
      "UTI": "36",
      "Hypertension": "39",
      "Diabetes": "40"
    };

    targetVisits.forEach(v => {
      const diag = v.diagnosis || "Other Disorders";
      if (!counts[diag]) counts[diag] = { newCases: 0, reVisits: 0, referrals: 0 };

      // Determine if it's a new case or re-visit (simplified)
      counts[diag].newCases++;
    });

    return Object.entries(counts).map(([disease, data], i) => ({
      code: mohCodeMap[Object.keys(mohCodeMap).find(k => disease.includes(k)) || ""] || (50 + i).toString(),
      disease,
      ...data
    })).sort((a, b) => Number(a.code) - Number(b.code));
  }, [filteredVisits, patients, mohFormType]);

  // Table Data generator based on tab
  const tableData = useMemo(() => {
    let data: any[] = []

    if (activeTab === "financial") {
      data = filteredVisits.map((v) => ({
        id: v.id,
        col1: new Date(v.startTime).toLocaleDateString(),
        col2: v.chiefComplaint || "General Visit",
        col3: v.totalBill % 2 === 0 ? "M-Pesa" : "Cash", // Proxy
        col4: (v.totalBill || 0).toLocaleString(),
        status: v.paymentStatus || "Pending",
      }))
    } else if (activeTab === "clinical") {
      data = filteredVisits.map((v) => ({
        id: v.id,
        col1: new Date(v.startTime).toLocaleDateString(),
        col2: v.patientName,
        col3: v.diagnosis || "Un-diagnosed",
        col4: v.doctorName || doctorsMap[v.doctorId] || "Unknown Doctor",
        status: v.stage,
      }))
    } else if (activeTab === "operational") {
      data = appointments.map((a) => ({
        id: a.id,
        col1: a.date,
        col2: a.patientName,
        col3: "Appointment",
        col4: a.status,
        status: "Logged",
      }))
    } else if (activeTab === "inventory") {
      data = inventoryLogs.map((log) => ({
        id: log.id,
        col1: new Date(log.created_at).toLocaleDateString(),
        col2: log.item_name,
        col3: log.action,
        col4: log.quantity_change > 0 ? `+${log.quantity_change}` : log.quantity_change,
        status: log.user_name || "System"
      }))
    }
    return data
  }, [activeTab, filteredVisits, appointments, inventoryLogs])

  // -- Filtered Data --
  const filteredTableData = useMemo(() => {
    let data = tableData

    // Drill down filter
    if (drillDownFilter) {
      data = data.filter((row) => {
        // Flexible matching: check if row values contain the drilldown value
        const vals = Object.values(row).map((v) => String(v).toLowerCase())
        const target = drillDownFilter.value.toLowerCase()
        return vals.some((v) => v.includes(target))
      })
    }

    // Search filter
    if (tableSearch) {
      const lower = tableSearch.toLowerCase()
      data = data.filter((row) => Object.values(row).some((val) => String(val).toLowerCase().includes(lower)))
    }
    return data
  }, [tableData, drillDownFilter, tableSearch])

  // -- Pagination Data --
  const totalPages = Math.ceil(filteredTableData.length / itemsPerPage)
  const paginatedTableData = filteredTableData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  // -- Actions --

  const handleChartClick = (data: any) => {
    if (data && data.name) {
      setDrillDownFilter({ category: "Category", value: data.name })
      // Scroll to table
      const tableElement = document.getElementById("reports-table")
      if (tableElement) tableElement.scrollIntoView({ behavior: "smooth" })
    }
  }

  const handleExportCSV = async () => {
    setIsExporting(true)

    try {
      let blob: Blob

      // Use exportService for server-side exports
      if (activeTab === "financial") {
        blob = await exportService.exportVisits({ format: exportFormat })
      } else if (activeTab === "clinical") {
        blob = await exportService.exportVisits({ format: exportFormat })
      } else if (activeTab === "operational") {
        blob = await exportService.exportAppointments({ format: exportFormat })
      } else if (activeTab === "moh") {
        blob = await exportService.exportMOHReport(mohData, mohFormType)
      } else {
        // Fallback for inventory or others
        const headers = activeTab === "inventory"
          ? ["ID", "Date", "Description", "User", "Change", "Status"]
          : Object.keys(filteredTableData[0] || {})
        const rows = filteredTableData.map((row) => Object.values(row).join(","))
        const csvContent = headers.join(",") + "\n" + rows.join("\n")
        blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      }

      // Trigger download
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `juaafya_${activeTab}_report_${timeRange}.${exportFormat}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      // Log export
      const { enterpriseDb } = await import("../services/enterprise-db")
      await enterpriseDb.logAudit(
        "report_exported",
        "report",
        `${activeTab}-${timeRange}`,
        {},
        { format: exportFormat, recordCount: filteredTableData.length },
      )
    } catch (error) {
      console.error("Export failed:", error)
      // Fallback to client-side export
      const headers =
        activeTab === "financial"
          ? ["ID", "Date", "Description", "Method", "Amount", "Status"]
          : activeTab === "clinical"
            ? ["Visit ID", "Date", "Patient", "Diagnosis", "Doctor", "Status"]
            : ["Log ID", "Date", "User", "Category", "Details", "Status"]
      const rows = filteredTableData.map((row) => Object.values(row).join(","))
      const csvContent = headers.join(",") + "\n" + rows.join("\n")
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `juaafya_${activeTab}_report_${timeRange}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }

  const getRangeLabel = () => {
    switch (timeRange) {
      case "7D":
        return "Last 7 Days"
      case "30D":
        return "Last 30 Days"
      case "3M":
        return "Last 3 Months"
      case "1Y":
        return "Year to Date"
    }
  }

  // -- Sub-components --

  const renderAIInsight = () => (
    <div className="bg-gradient-to-r from-brand-blue/10 to-brand-teal/10 dark:from-blue-900/20 dark:to-teal-900/20 p-4 rounded-xl border border-brand-blue/20 dark:border-blue-800 mb-6 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 no-print">
      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm text-brand-blue dark:text-blue-400">
        <Sparkles className="w-5 h-5" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-brand-dark dark:text-blue-200">AI Smart Insight</h4>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          {activeTab === "financial" &&
            `Revenue is trending ${timeRange === "7D" ? "stable" : "upwards"} compared to previous periods. M-Pesa remains the dominant payment channel (${paymentMethodData[0].value}%).`}
          {activeTab === "clinical" &&
            `Malaria cases account for approx ${((diseaseData[0]?.count / (diseaseData?.reduce((a, b) => a + b.count, 0) || 1)) * 100) | 0}% of visits this period. Consider verifying stock of anti-malarials.`}
          {activeTab === "operational" &&
            `Appointment completion rate is at ${operationalData[0]?.value}%. No-shows are higher on Mondays.`}
          {activeTab === "moh" &&
            `Data quality for MOH 705A is at 98%. Ensure all 'Under 5' weights are recorded to reach 100% compliance.`}
        </p>
      </div>
    </div>
  )

  const renderFinancialTab = () => (
    <div className="space-y-6">
      {renderAIInsight()}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Revenue</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                KSh {(financialData as any[]).reduce((acc: any, curr: any) => acc + curr.revenue, 0).toLocaleString()}
              </h3>
            </div>
            <div className="p-2 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600 font-medium">
            <span className="mr-1">↑ 12%</span> vs last period
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">M-Pesa Collections</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                KSh{" "}
                {(
                  ((financialData as any[]).reduce((acc: any, curr: any) => acc + curr.revenue, 0) *
                    (paymentMethodData[0].value / 100)) |
                  0
                ).toLocaleString()}
              </h3>
            </div>
            <div className="p-2 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-lg">
              <Smartphone className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600 font-medium">
            <span className="mr-1">↑ {paymentMethodData[0].value > 60 ? "High" : "Avg"}</span> adoption
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Cash Collections</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                KSh{" "}
                {(
                  ((financialData as any[]).reduce((acc: any, curr: any) => acc + curr.revenue, 0) *
                    (paymentMethodData[1].value / 100)) |
                  0
                ).toLocaleString()}
              </h3>
            </div>
            <div className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-600 rounded-lg">
              <Banknote className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-slate-500 font-medium">
            <span className="mr-1">●</span> Stable
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Area Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white mb-6">Revenue & Expense Trend</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={financialData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.1} />
                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.danger} stopOpacity={0.1} />
                    <stop offset="95%" stopColor={COLORS.danger} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} strokeDasharray="4 4" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  dy={10}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", borderRadius: "8px", border: "none", color: "#fff" }}
                  itemStyle={{ color: "#fff" }}
                />
                <Legend verticalAlign="top" height={36} />
                <Area
                  name="Revenue"
                  type="monotone"
                  dataKey="revenue"
                  stroke={COLORS.primary}
                  strokeWidth={3}
                  fill="url(#colorRev)"
                />
                <Area
                  name="Expenses"
                  type="monotone"
                  dataKey="expenses"
                  stroke={COLORS.danger}
                  strokeWidth={3}
                  fill="url(#colorExp)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods Donut */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col">
          <div className="mb-2">
            <h3 className="font-bold text-slate-900 dark:text-white">Payment Mix</h3>
            <p className="text-xs text-slate-500">Click segment to filter table</p>
          </div>

          <div className="h-52 w-full relative flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentMethodData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  onClick={handleChartClick}
                  cursor="pointer"
                >
                  {paymentMethodData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", borderRadius: "8px", border: "none", color: "#fff" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <Smartphone className="w-6 h-6 text-green-600 mb-1" />
              <span className="text-2xl font-bold text-slate-900 dark:text-white">{paymentMethodData[0].value}%</span>
              <span className="text-[10px] text-slate-500 uppercase">M-Pesa</span>
            </div>
          </div>
          <div className="space-y-3 mt-4">
            {paymentMethodData.map((item) => (
              <div
                key={item.name}
                className="flex justify-between items-center text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 p-1 rounded"
                onClick={() => handleChartClick(item)}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-slate-600 dark:text-slate-300">{item.name}</span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  const renderClinicalTab = () => (
    <div className="space-y-6">
      {renderAIInsight()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Diagnoses */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">Top Diagnoses</h3>
          <p className="text-xs text-slate-500 mb-6">Most common</p>
          {renderDiseaseCounts()}
        </div>

        {/* Gender Distribution */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">Gender Distribution</h3>
          <p className="text-xs text-slate-500 mb-6">{patients.length} total patients</p>
          {demographicsData.genderData.length > 0 ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={demographicsData.genderData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {demographicsData.genderData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", borderRadius: "8px", border: "none", color: "#fff" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium text-center">No data</p>
            </div>
          )}
        </div>

        {/* Age Distribution */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">Age Distribution</h3>
          <p className="text-xs text-slate-500 mb-6">By age group</p>
          {demographicsData.ageData.length > 0 ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={demographicsData.ageData} layout="vertical" margin={{ left: 60 }}>
                  <CartesianGrid horizontal={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={50}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    contentStyle={{ backgroundColor: "#1e293b", borderRadius: "8px", border: "none", color: "#fff" }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                    {demographicsData.ageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium text-center">No data</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const renderOperationalTab = () => (
    <div className="space-y-6">
      {renderAIInsight()}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Avg Wait Time</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">14 min</h3>
            </div>
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600 font-medium">
            <span className="mr-1">↓ 2 min</span> vs last week
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Staff Utilization</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">85%</h3>
            </div>
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-slate-500 font-medium">Optimal range</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">No-Show Rate</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">10%</h3>
            </div>
            <div className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600 font-medium">
            <span className="mr-1">↓ 5%</span> improved
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
        <h3 className="font-bold text-slate-900 dark:text-white mb-2">Appointment Status Breakdown</h3>
        <p className="text-xs text-slate-500 mb-6">Click bar to filter logs</p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={operationalData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid horizontal={false} stroke="#e2e8f0" strokeOpacity={0.5} />
              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                width={100}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 12, fontWeight: 500 }}
              />
              <Tooltip
                cursor={{ fill: "transparent" }}
                contentStyle={{ backgroundColor: "#1e293b", borderRadius: "8px", border: "none", color: "#fff" }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24} onClick={handleChartClick} cursor="pointer">
                {operationalData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )

  const renderInventoryTab = () => {
    const inventoryStats = useMemo(() => {
      const dispensed = inventoryLogs.filter(l => l.action === 'Dispensed').length
      const restocked = inventoryLogs.filter(l => l.action === 'Restocked' || l.action === 'Added').length
      return { dispensed, restocked }
    }, [inventoryLogs])

    const inventoryChartData = useMemo(() => {
      const grouped = inventoryLogs.reduce((acc, log) => {
        const dateKey = new Date(log.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
        if (!acc[dateKey]) acc[dateKey] = { name: dateKey, dispensed: 0, restocked: 0 }

        if (log.action === 'Dispensed') acc[dateKey].dispensed += Math.abs(log.quantity_change)
        else acc[dateKey].restocked += Math.abs(log.quantity_change)

        return acc
      }, {})
      return Object.values(grouped).slice(-7) // Last 7 active days
    }, [inventoryLogs])

    return (
      <div className="space-y-6 animate-in fade-in">
        {renderAIInsight()}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Total Logs</p>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">{inventoryLogs.length}</h3>
          </div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Low Stock Items</p>
            <h3 className="text-xl font-bold text-red-600 mt-1">{inventory.filter(i => i.stock <= i.minStockLevel).length}</h3>
          </div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Near Expiry</p>
            <h3 className="text-xl font-bold text-orange-600 mt-1">
              {inventory.filter(i => {
                if (!i.expiryDate) return false
                const days = (new Date(i.expiryDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24)
                return days <= 30 && days > 0
              }).length}
            </h3>
          </div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Restocked (Ops)</p>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">{inventoryStats.restocked}</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
            <h3 className="font-bold text-slate-900 dark:text-white mb-6">Stock Movement Trend</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={inventoryChartData}>
                  <defs>
                    <linearGradient id="colorDisp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.danger} stopOpacity={0.1} />
                      <stop offset="95%" stopColor={COLORS.danger} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorRest" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.1} />
                      <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} strokeDasharray="4 4" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", borderRadius: "12px", border: "none", color: "#fff" }} />
                  <Legend verticalAlign="top" height={36} />
                  <Area name="Dispensed" type="monotone" dataKey="dispensed" stroke={COLORS.danger} strokeWidth={3} fill="url(#colorDisp)" />
                  <Area name="Restocked" type="monotone" dataKey="restocked" stroke={COLORS.success} strokeWidth={3} fill="url(#colorRest)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">Action Breakdown</h3>
            <div className="flex-1 flex flex-col justify-center">
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Dispensed', value: inventoryStats.dispensed, color: COLORS.danger },
                        { name: 'Restocked', value: inventoryStats.restocked, color: COLORS.success },
                        { name: 'Others', value: inventoryLogs.length - (inventoryStats.dispensed + inventoryStats.restocked), color: COLORS.slate }
                      ]}
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {[COLORS.danger, COLORS.success, COLORS.slate].map((color, idx) => (
                        <Cell key={idx} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-4">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Dispensing Rate</span>
                  <span className="font-bold dark:text-white">{((inventoryStats.dispensed / (inventoryLogs.length || 1)) * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500" style={{ width: `${(inventoryStats.dispensed / (inventoryLogs.length || 1)) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderMohReport = () => {
    return (
      <div className="space-y-6 animate-in fade-in">
        {renderAIInsight()}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-green-600" />
              Ministry of Health Reporting (MOH 705)
            </h3>
            <p className="text-sm text-slate-500 mt-1">Automated generation of monthly outpatient summary forms.</p>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-xl">
            <button
              onClick={() => setMohFormType("705A")}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${mohFormType === "705A" ? "bg-white dark:bg-slate-600 shadow text-green-700 dark:text-green-400" : "text-slate-500"}`}
            >
              MOH 705A (Under 5)
            </button>
            <button
              onClick={() => setMohFormType("705B")}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${mohFormType === "705B" ? "bg-white dark:bg-slate-600 shadow text-green-700 dark:text-green-400" : "text-slate-500"}`}
            >
              MOH 705B (Over 5)
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border-b border-green-100 dark:border-green-900 flex justify-between items-center">
            <h4 className="font-bold text-green-800 dark:text-green-300 text-sm uppercase tracking-wide">
              {mohFormType === "705A" ? "Outpatient Register - Under 5 Years" : "Outpatient Register - Over 5 Years"}
            </h4>
            <button onClick={handleExportCSV} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
              <FileSpreadsheet className="w-4 h-4" />
              Download Excel
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[700px]">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 border-r w-24">Code</th>
                  <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 border-r">
                    Disease / Condition
                  </th>
                  <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 border-r text-center bg-slate-50/50 dark:bg-slate-800/50">
                    New Cases
                  </th>
                  <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 border-r text-center bg-slate-50/50 dark:bg-slate-800/50">
                    Re-Visits
                  </th>
                  <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 text-center bg-slate-50/50 dark:bg-slate-800/50">
                    Referrals In
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {mohData.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-6 py-3 border-r border-slate-100 dark:border-slate-700 font-mono font-bold text-slate-400">
                      {row.code}
                    </td>
                    <td className="px-6 py-3 border-r border-slate-100 dark:border-slate-100 font-medium text-slate-900 dark:text-white">
                      {row.disease}
                    </td>
                    <td className="px-6 py-3 border-r border-slate-100 dark:border-slate-100 text-center font-bold text-slate-700 dark:text-slate-300">
                      {row.newCases}
                    </td>
                    <td className="px-6 py-3 border-r border-slate-100 dark:border-slate-100 text-center text-slate-500">
                      {row.reVisits}
                    </td>
                    <td className="px-6 py-3 text-center text-slate-500">{row.referrals}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 dark:bg-slate-700/30 font-bold">
                  <td className="px-6 py-3 border-r border-slate-200 dark:border-slate-700">TOTAL</td>
                  <td className="px-6 py-3 border-r border-slate-200 dark:border-slate-700">ALL DIAGNOSES</td>
                  <td className="px-6 py-3 border-r border-slate-200 dark:border-slate-700 text-center">
                    {mohData.reduce((a: number, b: any) => a + b.newCases, 0)}
                  </td>
                  <td className="px-6 py-3 border-r border-slate-200 dark:border-slate-700 text-center">
                    {mohData.reduce((a: number, b: any) => a + b.reVisits, 0)}
                  </td>
                  <td className="px-6 py-3 text-center">{mohData.reduce((a: number, b: any) => a + b.referrals, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // Helper function to render disease counts with null safety
  const renderDiseaseCounts = () => {
    // Ensure diseaseData exists and has count property
    if (!diseaseData || diseaseData.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-slate-500">No diagnosis data available</p>
        </div>
      )
    }

    return (
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={diseaseData} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid horizontal={false} stroke="#e2e8f0" strokeOpacity={0.5} />
            <XAxis type="number" hide />
            <YAxis
              dataKey="name"
              type="category"
              width={100}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 12, fontWeight: 500 }}
            />
            <Tooltip
              cursor={{ fill: "transparent" }}
              contentStyle={{ backgroundColor: "#1e293b", borderRadius: "8px", border: "none", color: "#fff" }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20} onClick={handleChartClick} cursor="pointer">
              {diseaseData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div
      className="p-4 md:p-8 bg-gray-50 dark:bg-slate-900 min-h-screen transition-colors duration-200"
      onClick={() => setIsTimeMenuOpen(false)}
    >
      {/* Page Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8 no-print">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Reports & Analytics</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Enterprise insights & compliance for your clinic</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Filter Dropdown */}
          <div className="relative z-20">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsTimeMenuOpen(!isTimeMenuOpen)
              }}
              className="bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium transition-colors shadow-sm min-w-[160px] justify-between"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                {getRangeLabel()}
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${isTimeMenuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isTimeMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-xl rounded-xl overflow-hidden animate-in fade-in zoom-in-95 z-30">
                {[
                  { id: "7D", label: "Last 7 Days" },
                  { id: "30D", label: "Last 30 Days" },
                  { id: "3M", label: "Last 3 Months" },
                  { id: "1Y", label: "Year to Date" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setTimeRange(opt.id as TimeRange)}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${timeRange === opt.id ? "text-teal-600 font-bold bg-teal-50 dark:bg-teal-900/20" : "text-slate-600 dark:text-slate-300"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => window.print()}
            className="bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Print</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={isExporting}
            className="bg-brand-blue text-white flex items-center gap-2 px-5 py-2.5 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none text-sm font-bold transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isExporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 mb-8 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl w-fit overflow-x-auto max-w-full no-print">
        {[
          { id: "financial", label: "Financial", icon: DollarSign },
          { id: "clinical", label: "Clinical", icon: Activity },
          { id: "operational", label: "Operational", icon: FileText },
          { id: "inventory", label: "Inventory", icon: Package },
          { id: "moh", label: "MOH Compliance", icon: ScrollText },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ReportTab)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Filter Banner */}
      {drillDownFilter && (
        <div className="mb-6 p-3 bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-900 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2 no-print">
          <div className="flex items-center gap-2 text-sm text-teal-800 dark:text-teal-300">
            <Filter className="w-4 h-4" />
            <span className="font-medium">Filtering by:</span>
            <span className="font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
              {drillDownFilter.value}
            </span>
          </div>
          <button
            onClick={() => setDrillDownFilter(null)}
            className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear Filter
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="relative min-h-[400px]">
        {isLoading ? (
          <div className="absolute inset-0 z-10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex items-center justify-center rounded-3xl">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-teal-600 animate-spin" />
              <p className="text-sm font-bold text-slate-500">Updating analytics...</p>
            </div>
          </div>
        ) : null}

        {/* Tab Content */}
        <div className={`transition-opacity duration-300 ${isLoading ? "opacity-50" : "opacity-100"}`}>
          {activeTab === "financial" && renderFinancialTab()}
          {activeTab === "clinical" && renderClinicalTab()}
          {activeTab === "operational" && renderOperationalTab()}
          {activeTab === "inventory" && renderInventoryTab()}
          {activeTab === "moh" && renderMohReport()}
        </div>

        {/* Detailed Data Table (Common) - Hide for MOH as it has its own table */}
        {activeTab !== "moh" && (
          <div
            id="reports-table"
            className="mt-8 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-400" />
                {activeTab === "financial"
                  ? "Transactions"
                  : activeTab === "clinical"
                    ? "Patient Visits"
                    : "Activity Logs"}
              </h3>
              <div className="flex items-center gap-3 no-print">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    placeholder="Search records..."
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    className="pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 w-full sm:w-64 dark:text-white"
                  />
                  {tableSearch && (
                    <button
                      onClick={() => setTableSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs uppercase text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-4">ID</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">
                      {activeTab === "financial" ? "Description" : activeTab === "clinical" ? "Patient" : "User"}
                    </th>
                    <th className="px-6 py-4">
                      {activeTab === "financial" ? "Method" : activeTab === "clinical" ? "Diagnosis" : "Category"}
                    </th>
                    <th className="px-6 py-4">
                      {activeTab === "financial" ? "Amount" : activeTab === "clinical" ? "Doctor" : "Details"}
                    </th>
                    <th className="px-6 py-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                  {paginatedTableData.length > 0 ? (
                    paginatedTableData.map((row: any, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">{row.id}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{row.col1}</td>
                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{row.col2}</td>
                        <td className="px-6 py-4">
                          {activeTab === "financial" ? (
                            <span
                              className={`flex items-center gap-1.5 ${row.col3 === "M-Pesa" ? "text-green-600 font-bold" : row.col3 === "Cash" ? "text-slate-600" : "text-indigo-600"}`}
                            >
                              {row.col3 === "M-Pesa" && <Smartphone className="w-3.5 h-3.5" />}
                              {row.col3}
                            </span>
                          ) : (
                            <span className="text-slate-600 dark:text-slate-300">{row.col3}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">
                          {activeTab === "financial" ? `KSh ${row.col4}` : row.col4}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-md text-xs font-bold border border-green-100 dark:border-green-900/30">
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                        <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No records found matching your filters.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Showing page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 dark:text-slate-300"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 dark:text-slate-300"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Reports

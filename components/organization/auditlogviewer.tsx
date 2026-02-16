"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import {
  Activity,
  Search,
  Download,
  RefreshCw,
  Clock,
  User,
  FileText,
  AlertCircle,
  Check,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react"
import { enterpriseDb } from "@/services/enterprise-db"
import type { AuditLog } from "@/types/enterprise"

interface Props {
  limit?: number
}

const AuditLogViewer: React.FC<Props> = ({ limit = 100 }) => {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [actionFilter, setActionFilter] = useState<string>("All")
  const [resourceFilter, setResourceFilter] = useState<string>("All")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const itemsPerPage = 20

  useEffect(() => {
    loadLogs()
  }, [limit])

  const loadLogs = async () => {
    setIsLoading(true)
    try {
      const data = await enterpriseDb.getAuditLogs(limit)
      setLogs(data)
    } catch (error) {
      console.error("Error loading audit logs:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.resourceType.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesAction = actionFilter === "All" || log.action === actionFilter
      const matchesResource = resourceFilter === "All" || log.resourceType === resourceFilter
      return matchesSearch && matchesAction && matchesResource
    })
  }, [logs, searchTerm, actionFilter, resourceFilter])

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredLogs.slice(start, start + itemsPerPage)
  }, [filteredLogs, currentPage])

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage)

  const uniqueActions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))), [logs])
  const uniqueResources = useMemo(() => Array.from(new Set(logs.map((l) => l.resourceType))), [logs])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
      case "Success":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      case "failed":
      case "Failed":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      case "warning":
      case "Warning":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
      case "Success":
        return <Check className="w-3 h-3" />
      case "failed":
      case "Failed":
        return <X className="w-3 h-3" />
      case "warning":
      case "Warning":
        return <AlertCircle className="w-3 h-3" />
      default:
        return null
    }
  }

  const exportLogs = () => {
    const headers = ["Timestamp", "User", "Action", "Resource", "Status"]
    const rows = filteredLogs.map((log) => [
      new Date(log.createdAt).toISOString(),
      log.userName || "System",
      log.action,
      log.resourceType,
      log.status,
    ])
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `audit_logs_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center justify-center sm:justify-start gap-2">
            <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600" />
            Audit Logs
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">Track system activities and changes</p>
        </div>
        <div className="flex items-center justify-center sm:justify-end gap-2 sm:gap-3">
          <button
            onClick={() => loadLogs()}
            className="p-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={exportLogs}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="inline sm:hidden">Export</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 sm:gap-4">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="w-full pl-9 sm:pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value)
              setCurrentPage(1)
            }}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
          >
            <option value="All">Actions</option>
            {uniqueActions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>

          <select
            value={resourceFilter}
            onChange={(e) => {
              setResourceFilter(e.target.value)
              setCurrentPage(1)
            }}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
          >
            <option value="All">Resources</option>
            {uniqueResources.map((resource) => (
              <option key={resource} value={resource}>
                {resource}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {paginatedLogs.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white">
                      Timestamp
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white">User</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white">Action</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white">
                      Resource
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white">Status</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900 dark:text-white">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <Clock className="w-4 h-4" />
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
                            <User className="w-4 h-4 text-slate-500" />
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 dark:text-white text-sm">
                              {log.userName || "System"}
                            </div>
                            {log.userRole && <div className="text-xs text-slate-500">{log.userRole}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-slate-900 dark:text-white text-sm">{log.action}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <FileText className="w-4 h-4" />
                          {log.resourceType}
                          {log.resourceId && (
                            <span className="text-xs text-slate-400">#{log.resourceId.slice(0, 8)}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(log.status)}`}
                        >
                          {getStatusIcon(log.status)}
                          {log.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center px-6 py-4 border-t border-slate-200 dark:border-slate-700">
                <span className="text-sm text-slate-500">
                  Page {currentPage} of {totalPages} ({filteredLogs.length} logs)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-600 dark:text-slate-300"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-600 dark:text-slate-300"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">No audit logs found</p>
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Audit Log Details</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Timestamp</label>
                    <p className="text-slate-900 dark:text-white mt-1">
                      {new Date(selectedLog.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Status</label>
                    <p className="mt-1">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedLog.status)}`}
                      >
                        {selectedLog.status}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">User</label>
                    <p className="text-slate-900 dark:text-white mt-1">{selectedLog.userName || "System"}</p>
                    {selectedLog.userEmail && <p className="text-sm text-slate-500">{selectedLog.userEmail}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Role</label>
                    <p className="text-slate-900 dark:text-white mt-1">{selectedLog.userRole || "-"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Action</label>
                    <p className="text-slate-900 dark:text-white mt-1 font-mono">{selectedLog.action}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Resource</label>
                    <p className="text-slate-900 dark:text-white mt-1">
                      {selectedLog.resourceType}
                      {selectedLog.resourceId && (
                        <span className="text-sm text-slate-500 ml-2">#{selectedLog.resourceId.slice(0, 8)}</span>
                      )}
                    </p>
                  </div>
                </div>

                {selectedLog.oldValues && Object.keys(selectedLog.oldValues).length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block">Previous Values</label>
                    <pre className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-sm font-mono text-red-800 dark:text-red-300 overflow-x-auto">
                      {JSON.stringify(selectedLog.oldValues, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.newValues && Object.keys(selectedLog.newValues).length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block">New Values</label>
                    <pre className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl text-sm font-mono text-green-800 dark:text-green-300 overflow-x-auto">
                      {JSON.stringify(selectedLog.newValues, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.ipAddress && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">IP Address</label>
                    <p className="text-slate-900 dark:text-white mt-1 font-mono">{selectedLog.ipAddress}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AuditLogViewer

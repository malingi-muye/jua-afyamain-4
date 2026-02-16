"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Activity, Clock, User, FileText, Calendar, Package, RefreshCw, Loader2 } from "lucide-react"
import { enterpriseDb } from "@/services/enterprise-db"
import type { Activity as ActivityType } from "@/types/enterprise"

interface Props {
  limit?: number
  compact?: boolean
}

const getActivityIcon = (type: string) => {
  const icons: Record<string, React.ReactNode> = {
    patient_created: <User className="w-4 h-4" />,
    patient_updated: <User className="w-4 h-4" />,
    appointment_created: <Calendar className="w-4 h-4" />,
    appointment_updated: <Calendar className="w-4 h-4" />,
    visit_created: <Activity className="w-4 h-4" />,
    visit_updated: <Activity className="w-4 h-4" />,
    inventory_updated: <Package className="w-4 h-4" />,
    prescription_created: <FileText className="w-4 h-4" />,
  }
  return icons[type] || <Activity className="w-4 h-4" />
}

const getActivityColor = (type: string) => {
  if (type.includes("created")) return "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
  if (type.includes("updated")) return "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
  if (type.includes("deleted")) return "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
  return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
}

const ActivityFeed: React.FC<Props> = ({ limit = 20, compact = false }) => {
  const [activities, setActivities] = useState<ActivityType[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadActivities()
  }, [limit])

  const loadActivities = async () => {
    setIsLoading(true)
    try {
      const data = await enterpriseDb.getActivities(limit)
      setActivities(data)
    } catch (error) {
      console.error("Error loading activities:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
      </div>
    )
  }

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-600" />
            Recent Activity
          </h3>
          <button
            onClick={loadActivities}
            className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {activities.length > 0 ? (
          <div className="space-y-2">
            {activities.slice(0, 5).map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <div className={`p-1.5 rounded-lg ${getActivityColor(activity.activityType)}`}>
                  {getActivityIcon(activity.activityType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900 dark:text-white truncate">{activity.title}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimeAgo(activity.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 text-center py-4">No recent activity</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-teal-600" />
            Activity Feed
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Real-time updates from your organization</p>
        </div>
        <button
          onClick={loadActivities}
          className="p-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Activity List */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {activities.length > 0 ? (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <div className={`p-2 rounded-xl ${getActivityColor(activity.activityType)}`}>
                  {getActivityIcon(activity.activityType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white">{activity.title}</p>
                  {activity.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{activity.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimeAgo(activity.createdAt)}
                    </span>
                    {activity.resourceType && (
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {activity.resourceType}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">No activity recorded yet</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ActivityFeed

'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Filters {
  dateRange: string
  startDate: string
  endDate: string
  status: string
  department: string
  searchTerm: string
}

interface DashboardFiltersProps {
  filters: Filters
  onFilterChange: (filters: Partial<Filters>) => void
}

export default function DashboardFilters({
  filters,
  onFilterChange,
}: DashboardFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleDateRangeChange = (range: string) => {
    const today = new Date()
    let startDate = new Date()

    switch (range) {
      case 'week':
        startDate.setDate(today.getDate() - 7)
        break
      case 'month':
        startDate.setMonth(today.getMonth() - 1)
        break
      case 'quarter':
        startDate.setMonth(today.getMonth() - 3)
        break
      case 'year':
        startDate.setFullYear(today.getFullYear() - 1)
        break
      default:
        startDate = today
    }

    onFilterChange({
      dateRange: range,
      startDate: startDate.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
    })
  }

  const handleClearFilters = () => {
    onFilterChange({
      dateRange: 'month',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      status: 'all',
      department: 'all',
      searchTerm: '',
    })
  }

  const isFiltered =
    filters.status !== 'all' ||
    filters.department !== 'all' ||
    filters.searchTerm !== ''

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
      {/* Filter Header */}
      <div className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Filters
          </h3>
          {isFiltered && (
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded-full">
              {[
                filters.status !== 'all' ? 1 : 0,
                filters.department !== 'all' ? 1 : 0,
                filters.searchTerm ? 1 : 0,
              ].reduce((a, b) => a + b)} active
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            {isExpanded ? 'Hide' : 'Show'} Filters
          </button>
          {isFiltered && (
            <button
              onClick={handleClearFilters}
              className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Filter Content */}
      {isExpanded && (
        <div className="border-t border-slate-100 dark:border-slate-700 p-4 md:p-6 space-y-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, reason, or ID..."
                value={filters.searchTerm}
                onChange={(e) =>
                  onFilterChange({ searchTerm: e.target.value })
                }
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Date Range
            </label>
            <div className="flex flex-wrap gap-2">
              {['Today', 'Week', 'Month', 'Quarter', 'Year'].map((label) => (
                <button
                  key={label}
                  onClick={() =>
                    handleDateRangeChange(label.toLowerCase())
                  }
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filters.dateRange === label.toLowerCase()
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  onFilterChange({ startDate: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) =>
                  onFilterChange({ endDate: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) =>
                onFilterChange({ status: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
              <option value="No-Show">No Show</option>
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Department
            </label>
            <select
              value={filters.department}
              onChange={(e) =>
                onFilterChange({ department: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Departments</option>
              <option value="reception">Reception</option>
              <option value="triage">Triage</option>
              <option value="consultation">Consultation</option>
              <option value="lab">Lab</option>
              <option value="pharmacy">Pharmacy</option>
              <option value="billing">Billing</option>
            </select>
          </div>
        </div>
      )}
    </div>
  )
}

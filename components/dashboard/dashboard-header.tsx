'use client'

import { useState } from 'react'
import { LogOut, Settings, User as UserIcon, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DashboardHeaderProps {
  user: {
    id: string
    email: string
    name: string
    role: string
    avatar_url: string | null
  }
}

export default function DashboardHeader({ user }: DashboardHeaderProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/auth/login'
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {getGreeting()},
          </p>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
            {user.name}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Role: <span className="font-medium capitalize">{user.role}</span>
          </p>
        </div>

        <div className="relative">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {user.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </span>
              )}
            </div>
            <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>

          {isProfileOpen && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden z-50 animate-in fade-in zoom-in-95">
              <div className="p-3 border-b border-slate-100 dark:border-slate-700">
                <p className="font-semibold text-slate-900 dark:text-white text-sm">
                  {user.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {user.email}
                </p>
              </div>
              <div className="p-2 space-y-1">
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  <UserIcon className="w-4 h-4" />
                  My Profile
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
                <hr className="my-2 border-slate-200 dark:border-slate-700" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

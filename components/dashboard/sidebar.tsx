"use client"

import { useNavigate, useLocation } from "react-router-dom"
import { getSupabaseClient } from "@/lib/supabase/singleton"
import { useClinic } from "@/components/ClinicProvider"
import { Button } from "@/components/ui/button"
import { LayoutGrid, Users, Calendar, Package, BarChart3, Settings, LogOut, Menu, X } from "lucide-react"
import { useState } from "react"

const MENU_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/appointments", label: "Appointments", icon: Calendar },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { clinic } = useClinic()
  const [isOpen, setIsOpen] = useState(false)

  const handleLogout = async () => {
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
    navigate("/auth/login")
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <button className="fixed top-4 left-4 z-50 md:hidden" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed md:relative w-64 h-screen bg-slate-900 text-white transition-transform duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          } flex flex-col`}
      >
        {/* Clinic Header */}
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-2xl font-bold text-blue-400">{clinic?.name || "JuaAfya"}</h1>
          <p className="text-sm text-slate-400 mt-1">{clinic?.location || "Healthcare"}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <button
                key={item.href}
                onClick={() => {
                  navigate(item.href)
                  setIsOpen(false)
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"
                  }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-700">
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-slate-800"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsOpen(false)} />}
    </>
  )
}

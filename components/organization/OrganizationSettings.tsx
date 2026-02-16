"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import {
  Building2,
  Globe,
  CreditCard,
  Shield,
  Bell,
  Save,
  Upload,
  Loader2,
  Check,
  AlertCircle,
  Mail,
  Phone,
  MapPin,
} from "lucide-react"
import { useOrganization } from "@/components/OrganizationProvider"
import { supabase } from "@/lib/supabaseClient"

type SettingsTab = "general" | "billing" | "security" | "notifications"

interface Props {
  className?: string
}

const OrganizationSettingsPanel: React.FC<Props> = ({ className }) => {
  const { organization, updateOrganization, refreshOrganization, isLoading } = useOrganization()
  const [activeTab, setActiveTab] = useState<SettingsTab>("general")
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    currency: "KES",
    timezone: "Africa/Nairobi",
    consultationFee: 500,
    smsEnabled: true,
    appointmentReminders: true,
    lowStockAlerts: true,
  })

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || "",
        email: organization.email || "",
        phone: organization.phone || "",
        address: organization.address || "",
        currency: organization.currency || "KES",
        timezone: organization.timezone || "Africa/Nairobi",
        consultationFee: organization.settings?.consultationFee || 500,
        smsEnabled: organization.settings?.smsEnabled ?? true,
        appointmentReminders: organization.settings?.appointmentReminders ?? true,
        lowStockAlerts: organization.settings?.lowStockAlerts ?? true,
      })
    }
  }, [organization])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSaveSuccess(false)

    try {
      const success = await updateOrganization({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        currency: formData.currency,
        timezone: formData.timezone,
        settings: {
          ...(organization?.settings || {}),
          consultationFee: formData.consultationFee,
          smsEnabled: formData.smsEnabled,
          appointmentReminders: formData.appointmentReminders,
          lowStockAlerts: formData.lowStockAlerts,
          // Ensure currency is present to satisfy OrganizationSettings type
          currency: formData.currency || (organization?.settings as any)?.currency || 'KES',
        },
      })

      if (success) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      } else {
        setError("Failed to save settings")
      }
    } catch (err) {
      setError("An error occurred while saving")
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !organization) return

    try {
      // Upload to Supabase storage
      const fileExt = file.name.split(".").pop()
      const fileName = `${organization.id}/logo.${fileExt}`

      const { error: uploadError } = await supabase.storage.from("organization-assets").upload(fileName, file, {
        upsert: true,
      })

      if (uploadError) throw uploadError

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("organization-assets").getPublicUrl(fileName)

      await updateOrganization({ logoUrl: publicUrl })
      await refreshOrganization()
    } catch (err) {
      console.error("Error uploading logo:", err)
      setError("Failed to upload logo")
    }
  }

  const tabs = [
    { id: "general", label: "General", icon: Building2 },
    { id: "billing", label: "Billing", icon: CreditCard },
    { id: "security", label: "Security", icon: Shield },
    { id: "notifications", label: "Notifications", icon: Bell },
  ] as const

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    )
  }

  if (!organization) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">No Organization Found</h3>
        <p className="text-sm text-slate-500 mt-2">Please contact support if this issue persists.</p>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className || ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Organization Settings</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Manage your clinic&apos;s configuration and preferences
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-400 text-white font-semibold rounded-xl transition-colors"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saveSuccess ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isSaving ? "Saving..." : saveSuccess ? "Saved!" : "Save Changes"}
        </button>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "bg-teal-600 text-white"
                : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === "general" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Organization Identity */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Organization Identity</h3>

              <div className="flex flex-col sm:flex-row items-center gap-6 mb-8">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="w-24 h-24 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border-4 border-slate-50 dark:border-slate-600 shadow-inner">
                    {organization.logoUrl ? (
                      <img
                        src={organization.logoUrl || "/placeholder.svg"}
                        alt="Logo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Building2 className="w-10 h-10 text-slate-400" />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </div>
                <div className="text-center sm:text-left">
                  <h4 className="font-bold text-slate-900 dark:text-white">Organization Logo</h4>
                  <p className="text-xs text-slate-500 mt-1">Appears on invoices and reports. 400x400px recommended.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Organization Name</label>
                  <input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Primary Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-10 p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Admin Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      type="email"
                      className="w-full pl-10 p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full pl-10 p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Regional Settings */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <Globe className="w-5 h-5 text-slate-500" />
                Regional Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white"
                  >
                    <option value="KES">Kenyan Shilling (KES)</option>
                    <option value="USD">US Dollar (USD)</option>
                    <option value="EUR">Euro (EUR)</option>
                    <option value="GBP">British Pound (GBP)</option>
                    <option value="UGX">Ugandan Shilling (UGX)</option>
                    <option value="TZS">Tanzanian Shilling (TZS)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Timezone</label>
                  <select
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white"
                  >
                    <option value="Africa/Nairobi">East Africa Time (GMT+3)</option>
                    <option value="UTC">UTC</option>
                    <option value="Europe/London">London (GMT)</option>
                    <option value="America/New_York">Eastern Time (US)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Default Consultation Fee
                  </label>
                  <input
                    type="number"
                    value={formData.consultationFee}
                    onChange={(e) => setFormData({ ...formData, consultationFee: Number(e.target.value) })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Subscription Info */}
            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 p-6 rounded-2xl border border-teal-200 dark:border-teal-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-teal-900 dark:text-teal-300">Current Plan</h3>
                  <p className="text-sm text-teal-700 dark:text-teal-400 mt-1">
                    You are on the <span className="font-bold uppercase">{organization.plan}</span> plan
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-teal-600 dark:text-teal-400">
                    {organization.planSeats} seats • {organization.status}
                  </div>
                  {organization.trialEndsAt && (
                    <div className="text-xs text-amber-600 mt-1">Trial ends {organization.trialEndsAt}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "billing" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-slate-500" />
                Billing Information
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Billing management is handled by your system administrator. Contact support for plan changes.
              </p>
            </div>
          </div>
        )}

        {activeTab === "security" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <Shield className="w-5 h-5 text-slate-500" />
                Security Settings
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white text-sm">Row Level Security</div>
                    <div className="text-xs text-slate-500">All data is scoped to your organization</div>
                  </div>
                  <Check className="w-5 h-5 text-green-600" />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white text-sm">Audit Logging</div>
                    <div className="text-xs text-slate-500">All actions are logged for compliance</div>
                  </div>
                  <Check className="w-5 h-5 text-green-600" />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white text-sm">Data Encryption</div>
                    <div className="text-xs text-slate-500">All data encrypted at rest and in transit</div>
                  </div>
                  <Check className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "notifications" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <Bell className="w-5 h-5 text-slate-500" />
                Notification Preferences
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded-xl transition-colors">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white text-sm">SMS Alerts</div>
                    <div className="text-xs text-slate-500">Receive critical alerts via SMS</div>
                  </div>
                  <button
                    onClick={() => setFormData({ ...formData, smsEnabled: !formData.smsEnabled })}
                    className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${formData.smsEnabled ? "bg-teal-600" : "bg-slate-300"}`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${formData.smsEnabled ? "left-7" : "left-1"}`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded-xl transition-colors">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white text-sm">Appointment Reminders</div>
                    <div className="text-xs text-slate-500">Auto-send reminders to patients</div>
                  </div>
                  <button
                    onClick={() => setFormData({ ...formData, appointmentReminders: !formData.appointmentReminders })}
                    className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${formData.appointmentReminders ? "bg-teal-600" : "bg-slate-300"}`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${formData.appointmentReminders ? "left-7" : "left-1"}`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded-xl transition-colors">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white text-sm">Low Stock Alerts</div>
                    <div className="text-xs text-slate-500">Get notified when inventory is low</div>
                  </div>
                  <button
                    onClick={() => setFormData({ ...formData, lowStockAlerts: !formData.lowStockAlerts })}
                    className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${formData.lowStockAlerts ? "bg-teal-600" : "bg-slate-300"}`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${formData.lowStockAlerts ? "left-7" : "left-1"}`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default OrganizationSettingsPanel

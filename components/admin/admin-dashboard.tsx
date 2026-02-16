"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Spinner } from "@/components/ui/spinner"
import ClinicsList from "./clinics-list"
import CreateClinicDialog from "./create-clinic-dialog"

interface AdminDashboardProps {
  initialClinics: any[]
}

interface AdminSettings {
  id?: string
  platform_name: string
  support_email: string
  support_phone?: string
  logo_url?: string
  primary_color?: string
  secondary_color?: string
  maintenance_mode?: boolean
}

export default function AdminDashboard({ initialClinics }: AdminDashboardProps) {
  const [clinics, setClinics] = useState(initialClinics)
  const [isLoading, setIsLoading] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [settings, setSettings] = useState<AdminSettings>({
    platform_name: "JuaAfya",
    support_email: "support@juaafya.com",
    support_phone: "",
    maintenance_mode: false,
  })
  const { toast } = useToast()

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/admin/settings", {
        method: "GET",
      })

      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      }
    } catch (error) {
      console.error("Error loading settings:", error)
    }
  }

  const handleClinicCreated = (newClinic: any) => {
    setClinics((prev) => [newClinic, ...prev])
  }

  const handleSaveSettings = async () => {
    if (!settings.platform_name.trim() || !settings.support_email.trim()) {
      toast({
        title: "Error",
        description: "Platform name and support email are required",
        variant: "destructive",
      })
      return
    }

    setIsSavingSettings(true)
    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        throw new Error("Failed to save settings")
      }

      const data = await response.json()
      setSettings(data)

      toast({
        title: "Success",
        description: "Settings saved successfully",
      })
    } catch (error) {
      console.error("Error saving settings:", error)
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      })
    } finally {
      setIsSavingSettings(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">SuperAdmin Management</h1>
              <p className="text-muted-foreground mt-2">Manage all clinics and system settings</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="clinics" className="w-full">
          <TabsList>
            <TabsTrigger value="clinics">Clinics</TabsTrigger>
            <TabsTrigger value="statistics">Statistics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Clinics Tab */}
          <TabsContent value="clinics" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Manage Clinics</h2>
                <p className="text-muted-foreground">Create and manage all clinic tenants</p>
              </div>
              <CreateClinicDialog onClinicCreated={handleClinicCreated} />
            </div>

            <ClinicsList clinics={clinics} />
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="statistics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Total Clinics</CardTitle>
                  <CardDescription>Active clinic tenants</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{clinics.length}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Active Clinics</CardTitle>
                  <CardDescription>Currently operational</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{clinics.filter((clinic) => clinic.status === "active").length}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pro Plans</CardTitle>
                  <CardDescription>Paid subscriptions</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">
                    {clinics.filter((clinic) => clinic.plan === "pro" || clinic.plan === "enterprise").length}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
                <CardDescription>Configure platform-wide settings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Platform Name</Label>
                    <Input
                      type="text"
                      placeholder="JuaAfya"
                      value={settings.platform_name}
                      onChange={(e) => setSettings({ ...settings, platform_name: e.target.value })}
                      className="w-full mt-2"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Support Email</Label>
                    <Input
                      type="email"
                      placeholder="support@juaafya.com"
                      value={settings.support_email}
                      onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
                      className="w-full mt-2"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Support Phone (Optional)</Label>
                    <Input
                      type="tel"
                      placeholder="+254 XXX XXX XXX"
                      value={settings.support_phone || ""}
                      onChange={(e) => setSettings({ ...settings, support_phone: e.target.value })}
                      className="w-full mt-2"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Logo URL (Optional)</Label>
                    <Input
                      type="url"
                      placeholder="https://example.com/logo.png"
                      value={settings.logo_url || ""}
                      onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })}
                      className="w-full mt-2"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Primary Color (Optional)</Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          type="color"
                          value={settings.primary_color || "#007bff"}
                          onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                          className="w-12 h-10"
                        />
                        <Input
                          type="text"
                          placeholder="#007bff"
                          value={settings.primary_color || ""}
                          onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Secondary Color (Optional)</Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          type="color"
                          value={settings.secondary_color || "#6c757d"}
                          onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                          className="w-12 h-10"
                        />
                        <Input
                          type="text"
                          placeholder="#6c757d"
                          value={settings.secondary_color || ""}
                          onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={handleSaveSettings}
                    disabled={isSavingSettings}
                    className="w-full"
                  >
                    {isSavingSettings ? <Spinner /> : "Save Settings"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

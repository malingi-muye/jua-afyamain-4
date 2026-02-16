"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import LoginAsTenantDialog from "./login-as-tenant-dialog"

interface Clinic {
  id: string
  name: string
  email?: string
  phone?: string
  plan: string
  status: string
  currency: string
  country: string
  created_at: string
}

interface ClinicsListProps {
  clinics: Clinic[]
}

export default function ClinicsList({ clinics }: ClinicsListProps) {
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case "pro":
        return "bg-blue-100 text-blue-800"
      case "enterprise":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800"
      case "suspended":
        return "bg-red-100 text-red-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clinics.map((clinic) => (
          <Card key={clinic.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{clinic.name}</CardTitle>
                  <CardDescription>{clinic.country}</CardDescription>
                </div>
                <Badge className={getPlanBadgeColor(clinic.plan)} variant="secondary">
                  {clinic.plan}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium">{clinic.email || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge className={getStatusBadgeColor(clinic.status)} variant="secondary">
                    {clinic.status}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Currency:</span>
                  <span className="font-medium">{clinic.currency}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedClinic(clinic)
                    setShowDetails(true)
                  }}
                  className="flex-1"
                >
                  View Details
                </Button>
                <LoginAsTenantDialog clinic={clinic} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Details Dialog */}
      {selectedClinic && (
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedClinic.name}</DialogTitle>
              <DialogDescription>Clinic Details</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">ID</label>
                <p className="text-sm font-mono">{selectedClinic.id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <p className="text-sm">{selectedClinic.email || "Not set"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Phone</label>
                <p className="text-sm">{selectedClinic.phone || "Not set"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Created</label>
                <p className="text-sm">{new Date(selectedClinic.created_at).toLocaleDateString()}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Plan</label>
                  <Badge className={getPlanBadgeColor(selectedClinic.plan)}>{selectedClinic.plan}</Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <Badge className={getStatusBadgeColor(selectedClinic.status)}>{selectedClinic.status}</Badge>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

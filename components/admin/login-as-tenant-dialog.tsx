"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface Clinic {
  id: string
  name: string
}

interface LoginAsTenantDialogProps {
  clinic: Clinic
}

export default function LoginAsTenantDialog({ clinic }: LoginAsTenantDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [adminUsers, setAdminUsers] = useState<any[]>([])

  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen)

    if (isOpen) {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/organizations/${clinic.id}/users`)
        if (response.ok) {
          const { users } = await response.json()
          setAdminUsers(users.filter((u: any) => u.role === "admin"))
        }
      } catch (error) {
        console.error("Error fetching admins:", error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleLoginAs = async (userId: string) => {
    try {
      const response = await fetch("/api/admin/login-as-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: clinic.id,
          userId,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate login link")
      }

      const { loginLink } = await response.json()
      window.location.href = loginLink
    } catch (error) {
      console.error("Error:", error)
      alert("Failed to login as tenant")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          Login
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Login as {clinic.name}</DialogTitle>
          <DialogDescription>Select an admin user to login as</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <p className="text-muted-foreground">Loading admins...</p>
          </div>
        ) : adminUsers.length > 0 ? (
          <div className="space-y-2">
            {adminUsers.map((user) => (
              <Button
                key={user.id}
                variant="outline"
                className="w-full justify-start bg-transparent"
                onClick={() => handleLoginAs(user.id)}
              >
                <div className="flex flex-col items-start">
                  <span>{user.full_name}</span>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                </div>
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No admin users found in this clinic</p>
        )}
      </DialogContent>
    </Dialog>
  )
}

"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { getSupabaseClient } from "@/lib/supabase/singleton"
import { useClinic } from "@/components/ClinicProvider"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import type { Patient } from "@/types/database"

interface PatientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient: Patient | null
  onClose: () => void
}

export function PatientDialog({ open, onOpenChange, patient, onClose }: PatientDialogProps) {
  const { clinic } = useClinic()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<Partial<Patient>>({
    name: "",
    mrn: "",
    email: "",
    phone: "",
    age: 0,
    gender: "",
    blood_type: "",
  })

  useEffect(() => {
    if (patient) {
      setFormData(patient)
    } else {
      setFormData({
        name: "",
        mrn: "",
        email: "",
        phone: "",
        age: 0,
        gender: "",
        blood_type: "",
      })
    }
  }, [patient, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clinic) return

    setIsLoading(true)
    try {
      const supabase = getSupabaseClient()

      if (patient) {
        // Update
        const { error } = await supabase
          .from("patients")
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", patient.id)
        if (error) throw error
      } else {
        // Create
        const { error } = await supabase.from("patients").insert({
          ...formData,
          clinic_id: clinic.id,
        })
        if (error) throw error
      }

      onClose()
      onOpenChange(false)
    } catch (error) {
      console.error("[v0] Error saving patient:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{patient ? "Edit Patient" : "Add New Patient"}</DialogTitle>
          <DialogDescription>
            {patient ? "Update patient information" : "Add a new patient to your clinic"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Full Name *</Label>
              <Input
                required
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label>MRN (Medical Record Number) *</Label>
              <Input
                required
                value={formData.mrn || ""}
                onChange={(e) => setFormData({ ...formData, mrn: e.target.value })}
                placeholder="MRN-001"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email || ""}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={formData.phone || ""}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+254712345678"
              />
            </div>
            <div>
              <Label>Age</Label>
              <Input
                type="number"
                value={formData.age || ""}
                onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Gender</Label>
              <Select
                value={formData.gender || ""}
                onValueChange={(value) => setFormData({ ...formData, gender: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Blood Type</Label>
              <Select
                value={formData.blood_type || ""}
                onValueChange={(value) => setFormData({ ...formData, blood_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select blood type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A+">A+</SelectItem>
                  <SelectItem value="A-">A-</SelectItem>
                  <SelectItem value="B+">B+</SelectItem>
                  <SelectItem value="B-">B-</SelectItem>
                  <SelectItem value="O+">O+</SelectItem>
                  <SelectItem value="O-">O-</SelectItem>
                  <SelectItem value="AB+">AB+</SelectItem>
                  <SelectItem value="AB-">AB-</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Allergies</Label>
              <Input
                value={formData.allergies?.join(", ") || ""}
                onChange={(e) =>
                  setFormData({ ...formData, allergies: e.target.value.split(",").map((a) => a.trim()) })
                }
                placeholder="Penicillin, Aspirin"
              />
            </div>
            <div className="col-span-2">
              <Label>Medical History</Label>
              <Input
                value={formData.history?.join(", ") || ""}
                onChange={(e) =>
                  setFormData({ ...formData, history: e.target.value.split(",").map((c) => c.trim()) })
                }
                placeholder="Diabetes, Hypertension"
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Spinner /> : patient ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

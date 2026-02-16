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
import type { InventoryItem } from "@/types/database"

interface InventoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: InventoryItem | null
  onClose: () => void
}

export function InventoryDialog({ open, onOpenChange, item, onClose }: InventoryDialogProps) {
  const { clinic } = useClinic()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    name: "",
    sku: "",
    category: "Medicine",
    quantity_in_stock: 0,
    reorder_level: 10,
    unit: "pcs",
    price: 0,
    batch_number: "",
    expiry_date: "",
  })

  useEffect(() => {
    if (item) {
      setFormData(item)
    } else {
      setFormData({
        name: "",
        sku: "",
        category: "Medicine",
        quantity_in_stock: 0,
        reorder_level: 10,
        unit: "pcs",
        price: 0,
        batch_number: "",
        expiry_date: "",
      })
    }
  }, [item, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clinic) return

    setIsLoading(true)
    try {
      const supabase = getSupabaseClient()

      if (item) {
        // Update
        const { error } = await supabase
          .from("inventory")
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id)
        if (error) throw error
      } else {
        // Create
        const { error } = await supabase.from("inventory").insert({
          ...formData,
          clinic_id: clinic.id,
        })
        if (error) throw error
      }

      onClose()
      onOpenChange(false)
    } catch (error) {
      console.error("[v0] Error saving item:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Item" : "Add New Item"}</DialogTitle>
          <DialogDescription>{item ? "Update inventory item" : "Add a new item to your inventory"}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Item Name *</Label>
              <Input
                required
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Paracetamol 500mg"
              />
            </div>
            <div>
              <Label>SKU *</Label>
              <Input
                required
                value={formData.sku || ""}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="MED-001"
              />
            </div>
            <div>
              <Label>Category *</Label>
              <Select
                value={formData.category || "Medicine"}
                onValueChange={(value) => setFormData({ ...formData, category: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Medicine">Medicine</SelectItem>
                  <SelectItem value="Supply">Supply</SelectItem>
                  <SelectItem value="Lab">Lab</SelectItem>
                  <SelectItem value="Equipment">Equipment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unit</Label>
              <Input
                value={formData.unit || "pcs"}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="pcs, boxes, etc"
              />
            </div>
            <div>
              <Label>Quantity in Stock *</Label>
              <Input
                type="number"
                required
                value={formData.quantity_in_stock || 0}
                onChange={(e) => setFormData({ ...formData, quantity_in_stock: Number.parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label>Reorder Level</Label>
              <Input
                type="number"
                value={formData.reorder_level || 10}
                onChange={(e) => setFormData({ ...formData, reorder_level: Number.parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label>Unit Price (KES)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.price || 0}
                onChange={(e) => setFormData({ ...formData, price: Number.parseFloat(e.target.value) })}
              />
            </div>
            <div>
              <Label>Batch Number</Label>
              <Input
                value={formData.batch_number || ""}
                onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Expiry Date</Label>
              <Input
                type="date"
                value={formData.expiry_date || ""}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Spinner /> : item ? "Update" : "Add Item"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

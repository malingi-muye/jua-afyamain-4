import type { StateCreator } from "zustand"
import type { InventoryItem, Supplier, InventoryLog } from "../types"
import { db } from "../services/db"

export interface InventorySlice {
    inventory: InventoryItem[]
    suppliers: Supplier[]
    inventoryLogs: InventoryLog[]
    actions: {
        setInventory: (inventory: InventoryItem[]) => void
        setSuppliers: (suppliers: Supplier[]) => void
        addInventoryItem: (item: InventoryItem) => Promise<void>
        updateInventoryItem: (item: InventoryItem, reason?: string) => Promise<void>
        deleteInventoryItem: (id: string) => Promise<void>
        addSupplier: (supplier: Supplier) => Promise<void>
        updateSupplier: (supplier: Supplier) => Promise<void>
        deleteSupplier: (id: string) => Promise<void>
    }
}

export const createInventorySlice: StateCreator<
    InventorySlice & { isDemoMode: boolean; actions: { showToast: (msg: string, type?: "success" | "error" | "info") => void } },
    [],
    [],
    InventorySlice
> = (set, get) => ({
    inventory: [],
    suppliers: [],
    inventoryLogs: [],
    actions: {
        setInventory: (inventory) => set({ inventory }),
        setSuppliers: (suppliers) => set({ suppliers }),
        addInventoryItem: async (item) => {
            try {
                const saved = await db.createInventoryItem(item)
                if (!saved) throw new Error('Failed to create inventory item')
                set((state) => ({ inventory: [saved, ...state.inventory] }))
                get().actions.showToast(`${saved.name} added to inventory.`)
            } catch (e) {
                console.error('addInventoryItem error', e)
                get().actions.showToast("Error creating item", "error")
            }
        },
        updateInventoryItem: async (updatedItem, reason = "Updated details") => {
            try {
                await db.updateInventoryItem(updatedItem)
                set((state) => ({
                    inventory: state.inventory.map((i) => (i.id === updatedItem.id ? updatedItem : i)),
                }))
                get().actions.showToast(`${updatedItem.name} updated.`)
            } catch (e) {
                console.error('updateInventoryItem error', e)
                get().actions.showToast("Error updating item", "error")
            }
        },
        deleteInventoryItem: async (id) => {
            try {
                await db.deleteInventoryItem(id)
                set((state) => ({ inventory: state.inventory.filter((i) => i.id !== id) }))
                get().actions.showToast(`Item removed.`, "info")
            } catch (e) {
                console.error('deleteInventoryItem error', e)
                get().actions.showToast("Error deleting item", "error")
            }
        },
        addSupplier: async (supplier) => {
            try {
                const saved = await db.createSupplier(supplier)
                if (!saved) throw new Error('Failed to create supplier')
                set((state) => ({ suppliers: [...state.suppliers, saved] }))
                get().actions.showToast("Supplier added successfully.")
            } catch (e) {
                console.error('addSupplier error', e)
                get().actions.showToast("Error adding supplier", "error")
            }
        },
        updateSupplier: async (updated) => {
            try {
                await db.updateSupplier(updated)
                set((state) => ({
                    suppliers: state.suppliers.map((s) => (s.id === updated.id ? updated : s)),
                }))
                get().actions.showToast("Supplier updated.")
            } catch (e) {
                console.error('updateSupplier error', e)
                get().actions.showToast("Error updating supplier", "error")
            }
        },
        deleteSupplier: async (id) => {
            try {
                await db.deleteSupplier(id)
                set((state) => ({ suppliers: state.suppliers.filter((s) => s.id !== id) }))
                set((state) => ({
                    inventory: state.inventory.map((item) =>
                        item.supplierId === id ? { ...item, supplierId: undefined } : item,
                    ),
                }))
                get().actions.showToast("Supplier removed.", "info")
            } catch (e) {
                console.error('deleteSupplier error', e)
                get().actions.showToast("Error deleting supplier", "error")
            }
        },
    },
})

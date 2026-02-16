/**
 * Role-Based Access Control (RBAC) - Enterprise Edition
 * Standardized on capitalized roles to match database and system convention
 */

import type { Role } from "../types"
import type { UserRole } from "@/types/enterprise"

export type Permission =
  | "patient.view"
  | "patient.create"
  | "patient.edit"
  | "patient.delete"
  | "appointment.view"
  | "appointment.create"
  | "appointment.edit"
  | "appointment.delete"
  | "inventory.view"
  | "inventory.create"
  | "inventory.edit"
  | "inventory.delete"
  | "prescription.view"
  | "prescription.create"
  | "prescription.dispense"
  | "visit.view"
  | "visit.create"
  | "visit.edit"
  | "visit.complete"
  | "reports.view"
  | "reports.export"
  | "settings.view"
  | "settings.edit"
  | "team.view"
  | "team.manage"
  | "payments.view"
  | "payments.process"
  | "audit.view"
  | "sms.send"
  | "whatsapp.manage"
  | "backup.create"
  | "backup.restore"
  | "clinic.manage"
  | "clinic.billing"
  | "system.config"

const rolePermissions: Record<string, Permission[]> = {
  SuperAdmin: [
    "patient.view",
    "patient.create",
    "patient.edit",
    "patient.delete",
    "appointment.view",
    "appointment.create",
    "appointment.edit",
    "appointment.delete",
    "inventory.view",
    "inventory.create",
    "inventory.edit",
    "inventory.delete",
    "prescription.view",
    "prescription.create",
    "prescription.dispense",
    "visit.view",
    "visit.create",
    "visit.edit",
    "visit.complete",
    "reports.view",
    "reports.export",
    "settings.view",
    "settings.edit",
    "team.view",
    "team.manage",
    "payments.view",
    "payments.process",
    "audit.view",
    "sms.send",
    "whatsapp.manage",
    "backup.create",
    "backup.restore",
    "clinic.manage",
    "clinic.billing",
    "system.config",
  ],
  Admin: [
    "patient.view",
    "patient.create",
    "patient.edit",
    "patient.delete",
    "appointment.view",
    "appointment.create",
    "appointment.edit",
    "appointment.delete",
    "inventory.view",
    "inventory.create",
    "inventory.edit",
    "inventory.delete",
    "prescription.view",
    "prescription.create",
    "prescription.dispense",
    "visit.view",
    "visit.create",
    "visit.edit",
    "visit.complete",
    "reports.view",
    "reports.export",
    "settings.view",
    "settings.edit",
    "team.view",
    "team.manage",
    "payments.view",
    "payments.process",
    "audit.view",
    "sms.send",
    "whatsapp.manage",
    "backup.create",
    "clinic.billing",
  ],
  Doctor: [
    "patient.view",
    "patient.create",
    "patient.edit",
    "appointment.view",
    "appointment.create",
    "appointment.edit",
    "inventory.view",
    "prescription.view",
    "prescription.create",
    "prescription.dispense",
    "visit.view",
    "visit.create",
    "visit.edit",
    "visit.complete",
    "reports.view",
  ],
  Nurse: [
    "patient.view",
    "patient.create",
    "patient.edit",
    "appointment.view",
    "visit.view",
    "visit.create",
    "visit.edit",
    "inventory.view",
  ],
  Receptionist: [
    "patient.view",
    "patient.create",
    "patient.edit",
    "appointment.view",
    "appointment.create",
    "appointment.edit",
    "appointment.delete",
    "visit.view",
    "visit.create",
    "sms.send",
    "payments.view",
  ],
  Pharmacist: [
    "patient.view",
    "inventory.view",
    "inventory.create",
    "inventory.edit",
    "inventory.delete",
    "prescription.view",
    "prescription.dispense",
    "visit.view",
    "reports.view",
  ],
  "Lab Tech": ["patient.view", "visit.view", "visit.edit", "inventory.view", "reports.view"],
  Accountant: [
    "patient.view",
    "appointment.view",
    "inventory.view",
    "reports.view",
    "reports.export",
    "payments.view",
    "payments.process",
    "audit.view",
  ],
}

export const viewAccessMap: Record<string, (Role | UserRole)[]> = {
  // Super Admin Views
  "sa-overview": ["SuperAdmin", "super_admin"],
  "sa-clinics": ["SuperAdmin", "super_admin"],
  "sa-approvals": ["SuperAdmin", "super_admin"],
  "sa-payments": ["SuperAdmin", "super_admin"],
  "sa-support": ["SuperAdmin", "super_admin"],
  "sa-settings": ["SuperAdmin", "super_admin"],

  // Clinic Views
  dashboard: [
    "Admin",
    "Doctor",
    "Nurse",
    "Receptionist",
    "Pharmacist",
    "Lab Tech",
    "Accountant",
  ],
  reception: ["Admin", "Receptionist"],
  triage: ["Admin", "Nurse", "Doctor"],
  consultation: ["Admin", "Doctor"],
  "lab-work": ["Admin", "Lab Tech", "Doctor"],
  "billing-desk": ["Admin", "Receptionist", "Accountant"],
  pharmacy: ["Admin", "Pharmacist", "Doctor"],
  patients: ["Admin", "Doctor", "Nurse", "Receptionist"],
  appointments: ["Admin", "Doctor", "Nurse", "Receptionist"],
  "whatsapp-agent": [
    "Admin",
    "Doctor",
    "Nurse",
    "Receptionist",
    "Pharmacist",
  ],
  "bulk-sms": ["Admin", "Receptionist"],
  reports: ["Admin", "Doctor", "Accountant"],
  settings: ["Admin"],
  helpdesk: ["Admin", "Doctor", "Nurse", "Receptionist", "Pharmacist", "Lab Tech", "Accountant"],
  profile: [
    "Admin",
    "Doctor",
    "Nurse",
    "Receptionist",
    "Pharmacist",
    "Lab Tech",
    "Accountant",
    "SuperAdmin",
  ],
}

export function canAccessView(role: Role | UserRole, view: string): boolean {
  const allowedRoles = viewAccessMap[view]
  if (!allowedRoles) return false

  const normalizedRole = role.toString().toLowerCase()
  return allowedRoles.some(r => r.toLowerCase() === normalizedRole)
}

export function getDefaultViewForRole(role: Role | UserRole): string {
  if (!role) return "dashboard"
  const normalizedRole = role.toString().toLowerCase().replace(" ", "_")

  switch (normalizedRole) {
    case "superadmin":
    case "super_admin":
      return "sa-overview"
    case "doctor":
      return "consultation"
    case "nurse":
      return "triage"
    case "receptionist":
      return "reception"
    case "pharmacist":
      return "pharmacy"
    case "lab_tech":
    case "lab tech":
      return "lab-work"
    case "accountant":
      return "billing-desk"
    case "admin":
    default:
      return "dashboard"
  }
}

export function hasPermission(role: Role | UserRole, permission: Permission): boolean {
  const normalizedRole = role.toString().toLowerCase()
  const matchingRole = Object.keys(rolePermissions).find(k => k.toLowerCase() === normalizedRole)
  if (!matchingRole) return false
  return rolePermissions[matchingRole]?.includes(permission) ?? false
}

export function hasPermissions(role: Role | UserRole, permissions: Permission[]): boolean {
  return permissions.every((perm) => hasPermission(role, perm))
}

export function hasAnyPermission(role: Role | UserRole, permissions: Permission[]): boolean {
  return permissions.some((perm) => hasPermission(role, perm))
}

export function getRolePermissions(role: Role | UserRole): Permission[] {
  const normalizedRole = role.toString().toLowerCase()
  const matchingRole = Object.keys(rolePermissions).find(k => k.toLowerCase() === normalizedRole)
  if (!matchingRole) return []
  return rolePermissions[matchingRole] ?? []
}

export function getRolesWithPermission(permission: Permission): (Role | UserRole)[] {
  return Object.entries(rolePermissions)
    .filter(([, perms]) => perms.includes(permission))
    .map(([role]) => role as Role | UserRole)
}

export function canAccess(role: Role | UserRole | undefined, permission: Permission): boolean {
  if (!role) return false
  return hasPermission(role, permission)
}

export async function guardAction<T>(
  role: Role | UserRole | undefined,
  permission: Permission,
  action: () => T | Promise<T>,
): Promise<T> {
  if (!role || !hasPermission(role, permission)) {
    throw new Error(`Permission denied: ${permission} required`)
  }
  return action()
}

export function canViewResource(role: Role | UserRole): boolean {
  return hasAnyPermission(role, ["patient.view", "appointment.view", "inventory.view", "visit.view"])
}

export function canManageResources(role: Role | UserRole): boolean {
  return hasAnyPermission(role, ["patient.edit", "appointment.edit", "inventory.edit"])
}

export function isAdmin(role: Role | UserRole): boolean {
  const normalizedRole = role.toString().toLowerCase()
  return normalizedRole === "admin" || normalizedRole === "superadmin" || normalizedRole === "super_admin"
}

export function isSuperAdmin(role: Role | UserRole): boolean {
  const normalizedRole = role.toString().toLowerCase()
  return normalizedRole === "superadmin" || normalizedRole === "super_admin"
}

/**
 * Enterprise Permission System
 * Defines capabilities and role-based access control
 */

import type { UserRole } from "../types/enterprise"

export type Permission =
  // Patient permissions
  | "patients.view"
  | "patients.create"
  | "patients.edit"
  | "patients.delete"
  | "patients.export"

  // Appointment permissions
  | "appointments.view"
  | "appointments.create"
  | "appointments.edit"
  | "appointments.cancel"
  | "appointments.delete"

  // Visit permissions
  | "visits.view"
  | "visits.create"
  | "visits.edit"
  | "visits.complete"

  // Inventory permissions
  | "inventory.view"
  | "inventory.create"
  | "inventory.edit"
  | "inventory.delete"
  | "inventory.adjust"

  // Pharmacy permissions
  | "pharmacy.view"
  | "pharmacy.dispense"

  // Billing permissions
  | "billing.view"
  | "billing.manage"
  | "billing.refund"

  // Reports permissions
  | "reports.view"
  | "reports.export"
  | "reports.moh"

  // SMS permissions
  | "sms.send"
  | "sms.broadcast"

  // Settings permissions
  | "settings.view"
  | "settings.edit"
  | "settings.team"
  | "settings.billing"
  | "settings.delete_clinic"

  // Super admin permissions
  | "super_admin.*"
  | "super_admin.clinics"
  | "super_admin.impersonate"
  | "super_admin.suspend"
  | "super_admin.delete"
  // Wildcard permissions for role matrix convenience
  | "patients.*"
  | "appointments.*"
  | "visits.*"
  | "inventory.*"
  | "pharmacy.*"
  | "billing.*"
  | "reports.*"
  | "sms.*"
  | "settings.*"

/**
 * Permission matrix: Maps roles to their permissions
 */
const PERMISSION_MATRIX: Record<UserRole, Permission[]> = {
  SuperAdmin: [
    "super_admin.*",
    "super_admin.clinics",
    "super_admin.impersonate",
    "super_admin.suspend",
    "super_admin.delete",
  ],
  super_admin: [
    "super_admin.*",
    "super_admin.clinics",
    "super_admin.impersonate",
    "super_admin.suspend",
    "super_admin.delete",
  ],

  Admin: [
    // Full access to all clinic operations
    "patients.*",
    "appointments.*",
    "visits.*",
    "inventory.*",
    "pharmacy.*",
    "billing.*",
    "reports.*",
    "sms.*",
    "settings.*",
  ],

  Doctor: [
    "patients.view",
    "patients.create",
    "patients.edit",
    "appointments.view",
    "appointments.create",
    "appointments.edit",
    "visits.view",
    "visits.create",
    "visits.edit",
    "visits.complete",
    "inventory.view",
    "pharmacy.view",
    "pharmacy.dispense",
    "reports.view",
  ],

  Nurse: [
    "patients.view",
    "patients.create",
    "patients.edit",
    "appointments.view",
    "visits.view",
    "visits.create",
    "visits.edit",
    "inventory.view",
  ],

  Receptionist: [
    "patients.view",
    "patients.create",
    "patients.edit",
    "appointments.view",
    "appointments.create",
    "appointments.edit",
    "appointments.cancel",
    "visits.view",
    "visits.create",
    "billing.view",
    "sms.send",
  ],

  Pharmacist: [
    "patients.view",
    "visits.view",
    "inventory.view",
    "inventory.create",
    "inventory.edit",
    "inventory.adjust",
    "pharmacy.view",
    "pharmacy.dispense",
    "reports.view",
  ],

  "Lab Tech": [
    "patients.view",
    "visits.view",
    "visits.edit",
    "inventory.view",
    "reports.view",
  ],

  Accountant: [
    "patients.view",
    "appointments.view",
    "visits.view",
    "inventory.view",
    "billing.view",
    "billing.manage",
    "reports.view",
    "reports.export",
  ],
}

/**
 * Check if a user role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  // Case-insensitive role lookup
  const normalizedRole = role.toString().toLowerCase()
  const matchingRoleKey = Object.keys(PERMISSION_MATRIX).find(k => k.toLowerCase() === normalizedRole)
  const rolePermissions = matchingRoleKey ? PERMISSION_MATRIX[matchingRoleKey as UserRole] : []

  // Super admin has all permissions
  if (rolePermissions.includes("super_admin.*")) {
    return true
  }

  // Check exact permission
  if (rolePermissions.includes(permission)) {
    return true
  }

  // Check wildcard permissions (e.g., "patients.*" matches "patients.view")
  const [resource, action] = permission.split(".")
  const wildcardPermission = `${resource}.*` as Permission

  if (rolePermissions.includes(wildcardPermission)) {
    return true
  }

  return false
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return PERMISSION_MATRIX[role] || []
}

/**
 * Check if user can perform action on resource
 * Convenience function for common patterns
 */
export function can(role: UserRole, resource: string, action: string): boolean {
  const permission = `${resource}.${action}` as Permission
  return hasPermission(role, permission)
}

// Enterprise Types for Multitenancy and RBAC

export type OrganizationPlan = "free" | "pro" | "enterprise"
export type OrganizationStatus = "active" | "suspended" | "pending" | "cancelled"


export type UserStatus = "active" | "invited" | "suspended" | "deactivated"


export interface Organization {
  id: string
  name: string
  slug: string
  ownerId?: string
  logoUrl?: string
  email?: string
  phone?: string
  address?: string
  country: string
  currency: string
  timezone: string
  plan: OrganizationPlan
  planSeats: number
  status: OrganizationStatus
  trialEndsAt?: string
  settings: OrganizationSettings
  metadata: Record<string, any>
  createdAt: string
  updatedAt: string
}

// Backwards-compatible alias: some modules refer to `Clinic`
export type Clinic = Organization

export interface OrganizationSettings {
  smsEnabled: boolean
  appointmentReminders: boolean
  lowStockAlerts: boolean
  consultationFee: number
  currency: string
  workingHours?: {
    start: string
    end: string
  }
  [key: string]: any
}

export interface User {
  id: string
  clinicId?: string
  email: string
  fullName: string
  phone?: string
  avatarUrl?: string
  role: UserRole
  department?: string
  licenseNumber?: string
  specialization?: string
  status: UserStatus
  lastLoginAt?: string
  lastActiveAt?: string
  preferences: UserPreferences
  createdAt: string
  updatedAt: string
}

export interface UserPreferences {
  theme?: "light" | "dark" | "system"
  notifications?: {
    email: boolean
    sms: boolean
    push: boolean
  }
  [key: string]: any
}

export interface OrganizationInvitation {
  id: string
  clinicId: string
  email: string
  role: UserRole
  invitedBy?: string
  token: string
  status: "pending" | "accepted" | "expired" | "cancelled"
  expiresAt: string
  acceptedAt?: string
  createdAt: string
}

export interface AuditLog {
  id: string
  clinicId?: string
  userId?: string
  userEmail?: string
  userName?: string
  userRole?: string
  action: string
  resourceType: string
  resourceId?: string
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
  metadata: Record<string, any>
  ipAddress?: string
  userAgent?: string
  status: "Success" | "Failed" | "Warning"
  createdAt: string
}

export interface Activity {
  id: string
  clinicId: string
  userId?: string
  activityType: string
  title: string
  description?: string
  icon?: string
  color?: string
  resourceType?: string
  resourceId?: string
  metadata: Record<string, any>
  createdAt: string
}

export interface Permission {
  id: string
  name: string
  description?: string
  module: string
  createdAt: string
}

export interface RolePermission {
  id: string
  role: UserRole
  permissionId: string
  createdAt: string
}

// Session and Auth Context
export interface AuthSession {
  user: User | null
  organization: Organization | null
  isLoading: boolean
  isAuthenticated: boolean
  isSuperAdmin: boolean
  isOrgAdmin: boolean
}

// Permission Checking
export type PermissionAction = "view" | "create" | "edit" | "delete" | "export" | "manage" | "dispense" | "send"

export type PermissionModule =
  | "dashboard"
  | "patients"
  | "appointments"
  | "visits"
  | "inventory"
  | "pharmacy"
  | "reports"
  | "settings"
  | "team"
  | "billing"
  | "sms"
  | "audit"
  | "admin"

export type UserRole =
  | "SuperAdmin"
  | "super_admin"
  | "Admin"
  | "Doctor"
  | "Nurse"
  | "Receptionist"
  | "Lab Tech"
  | "Pharmacist"
  | "Accountant"

// Role Display Names
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  SuperAdmin: "Super Admin",
  super_admin: "Super Admin",
  Admin: "Admin",
  Doctor: "Doctor",
  Nurse: "Nurse",
  Receptionist: "Receptionist",
  "Lab Tech": "Lab Tech",
  Pharmacist: "Pharmacist",
  Accountant: "Accountant",
}

// Legacy Role Mapping (to normalize anything to our standard capitalized roles)
export const LEGACY_ROLE_MAP: Record<string, UserRole> = {
  super_admin: "SuperAdmin",
  admin: "Admin",
  doctor: "Doctor",
  nurse: "Nurse",
  receptionist: "Receptionist",
  lab_tech: "Lab Tech",
  "Lab Tech": "Lab Tech",
  pharmacist: "Pharmacist",
  accountant: "Accountant",
  // Identity mappings for safety
  SuperAdmin: "SuperAdmin",
  Admin: "Admin",
  Doctor: "Doctor",
  Nurse: "Nurse",
  Receptionist: "Receptionist",
  Pharmacist: "Pharmacist",
  Accountant: "Accountant",
}

export const NEW_ROLE_MAP: Record<UserRole, string> = {
  SuperAdmin: "super_admin",
  super_admin: "super_admin",
  Admin: "admin",
  Doctor: "doctor",
  Nurse: "nurse",
  Receptionist: "receptionist",
  "Lab Tech": "lab_tech",
  Pharmacist: "pharmacist",
  Accountant: "accountant",
}

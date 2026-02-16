"use client"

/**
 * usePermissions Hook
 * Provides easy access to RBAC functionality in React components
 */

import { useMemo } from "react"
import type { Role } from "../types"
import {
  type Permission,
  hasPermission,
  hasAnyPermission,
  hasPermissions,
  getRolePermissions,
  isAdmin,
  isSuperAdmin,
} from "../lib/rbac"

interface UsePermissionsReturn {
  // Permission checks
  can: (permission: Permission) => boolean
  canAll: (permissions: Permission[]) => boolean
  canAny: (permissions: Permission[]) => boolean

  // Role checks
  isAdmin: boolean
  isSuperAdmin: boolean

  // Get all permissions
  permissions: Permission[]

  // Current role
  role: Role | undefined
}

export function usePermissions(role: Role | undefined): UsePermissionsReturn {
  const permissions = useMemo(() => {
    if (!role) return []
    return getRolePermissions(role)
  }, [role])

  const can = useMemo(() => {
    return (permission: Permission): boolean => {
      if (!role) return false
      return hasPermission(role, permission)
    }
  }, [role])

  const canAll = useMemo(() => {
    return (perms: Permission[]): boolean => {
      if (!role) return false
      return hasPermissions(role, perms)
    }
  }, [role])

  const canAny = useMemo(() => {
    return (perms: Permission[]): boolean => {
      if (!role) return false
      return hasAnyPermission(role, perms)
    }
  }, [role])

  return {
    can,
    canAll,
    canAny,
    isAdmin: role ? isAdmin(role) : false,
    isSuperAdmin: role ? isSuperAdmin(role) : false,
    permissions,
    role,
  }
}

export default usePermissions

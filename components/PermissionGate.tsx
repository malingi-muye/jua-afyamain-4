/**
 * Permission Gate Component
 * Wraps UI elements that require specific permissions
 */

import React from "react"
import type { UserRole } from "../types/enterprise"
import type { Permission } from "../lib/permissions"
import { hasPermission } from "../lib/permissions"

interface PermissionGateProps {
  permission: Permission
  userRole: UserRole
  children: React.ReactNode
  fallback?: React.ReactNode
  showError?: boolean
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  permission,
  userRole,
  children,
  fallback = null,
  showError = false,
}) => {
  const hasAccess = hasPermission(userRole, permission)

  if (hasAccess) {
    return <>{children}</>
  }

  if (showError) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
        <p className="text-sm text-red-700 dark:text-red-400">
          You don't have permission to access this feature.
        </p>
      </div>
    )
  }

  return <>{fallback}</>
}

/**
 * Hook to check permissions
 */
export function usePermission(permission: Permission, userRole: UserRole): boolean {
  return hasPermission(userRole, permission)
}

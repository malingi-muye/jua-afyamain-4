/**
 * Role mapping utilities
 * Maps UI-facing `Role` strings to enterprise `UserRole` values used by the permission system.
 */
import type { UserRole } from '../types/enterprise'
import type { TeamMember } from '../types'
import { hasPermission } from './permissions'
import useStore from '../store'

import { LEGACY_ROLE_MAP } from '../types/enterprise'

export function mapRoleToUserRole(role?: string): UserRole | undefined {
  if (!role) return undefined
  return LEGACY_ROLE_MAP[role] || LEGACY_ROLE_MAP[role.toLowerCase()] || undefined
}

export function userRoleFromMember(member?: TeamMember): UserRole | undefined {
  return mapRoleToUserRole(member?.role)
}

/**
 * Helper that uses current store user to check a permission quickly.
 * Returns false if no user or mapping is available.
 */
export function canCurrentUser(permission: string): boolean {
  try {
    const { currentUser } = useStore.getState()
    const userRole = mapRoleToUserRole(currentUser?.role)
    if (!userRole) return false
    return hasPermission(userRole as UserRole, permission as any)
  } catch (e) {
    return false
  }
}

export default mapRoleToUserRole

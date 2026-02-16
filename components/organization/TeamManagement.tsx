"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import {
  Users,
  UserPlus,
  Mail,
  MoreHorizontal,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  Loader2,
  Search,
  Edit,
  Ban,
  RefreshCw,
} from "lucide-react"
import { useOrganization } from "@/components/OrganizationProvider"
import { enterpriseDb } from "@/services/enterprise-db"
import type { User, UserRole, OrganizationInvitation } from "@/types/enterprise"
import { ROLE_DISPLAY_NAMES } from "@/types/enterprise"
import { canCurrentUser } from "../../lib/roleMapper"
import useStore from '../../store'

const ROLES: UserRole[] = ["Admin", "Doctor", "Nurse", "Receptionist", "Pharmacist", "Lab Tech", "Accountant"]

interface Props {
  currentUserId?: string
}

const TeamManagement: React.FC<Props> = ({ currentUserId }) => {
  const { organization, members, refreshMembers, isLoading } = useOrganization()
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<User | null>(null)
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([])

  const [inviteForm, setInviteForm] = useState({ email: "", role: "Doctor" as UserRole })
  const [isInviting, setIsInviting] = useState(false)
  const [inviteError, setInviteError] = useState("")
  const [inviteSuccess, setInviteSuccess] = useState("")

  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<UserRole | "All">("All")
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All")
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)

  useEffect(() => {
    loadInvitations()
  }, [])

  const loadInvitations = async () => {
    const inv = await enterpriseDb.getInvitations()
    setInvitations(inv.filter((i) => i.status === "pending"))
  }

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const matchesSearch =
        member.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesRole = roleFilter === "All" || member.role === roleFilter
      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Active" && member.status === "active") ||
        (statusFilter === "Inactive" && member.status !== "active")
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [members, searchTerm, roleFilter, statusFilter])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteError("")
    setInviteSuccess("")

    if (!canCurrentUser('settings.team')) {
      setInviteError('You do not have permission to invite team members.')
      return
    }

    if (!inviteForm.email || !inviteForm.email.includes("@")) {
      setInviteError("Please enter a valid email address")
      return
    }

    setIsInviting(true)

    try {
      const invitation = await enterpriseDb.createInvitation(inviteForm.email, inviteForm.role)
      if (invitation) {
        setInviteSuccess(`Invitation sent to ${inviteForm.email}`)
        setInvitations([invitation, ...invitations])
        setInviteForm({ email: "", role: "Doctor" })
        setTimeout(() => setShowInviteModal(false), 2000)
      } else {
        setInviteError("Failed to create invitation")
      }
    } catch (err: any) {
      setInviteError(err.message || "Failed to send invitation")
    } finally {
      setIsInviting(false)
    }
  }

  const handleCancelInvitation = async (id: string) => {
    if (!canCurrentUser('settings.team')) {
      useStore.getState().actions.showToast('You do not have permission to cancel invitations.', 'error')
      return
    }
    const success = await enterpriseDb.cancelInvitation(id)
    if (success) {
      setInvitations(invitations.filter((i) => i.id !== id))
    }
  }

  const handleDeactivateMember = async (userId: string) => {
    if (userId === currentUserId) return
    if (!canCurrentUser('settings.team')) {
      useStore.getState().actions.showToast('You do not have permission to deactivate team members.', 'error')
      return
    }
    const success = await enterpriseDb.deactivateTeamMember(userId)
    if (success) {
      await refreshMembers()
    }
  }

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    if (!canCurrentUser('settings.team')) {
      useStore.getState().actions.showToast('You do not have permission to change roles.', 'error')
      return
    }
    const success = await enterpriseDb.updateTeamMember(userId, { role: newRole })
    if (success) {
      await refreshMembers()
      setShowEditModal(false)
      setSelectedMember(null)
    }
  }

  const getRoleColor = (role: UserRole) => {
    const colors: Record<UserRole, string> = {
      SuperAdmin: "bg-slate-900 text-white dark:bg-slate-600",
      super_admin: "bg-slate-900 text-white dark:bg-slate-600",
      Admin: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      Doctor: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      Nurse: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      Receptionist: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      Pharmacist: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      "Lab Tech": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
      Accountant: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    }
    return colors[role] || "bg-slate-100 text-slate-700"
  }

  const stats = useMemo(
    () => ({
      total: members.length,
      active: members.filter((m) => m.status === "active").length,
      inactive: members.filter((m) => m.status !== "active").length,
      pending: invitations.length,
    }),
    [members, invitations],
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Team Members</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Manage staff access and permissions</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refreshMembers()}
            className="p-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              if (!canCurrentUser('settings.team')) { useStore.getState().actions.showToast('You do not have permission to invite team members.', 'error'); return }
              setShowInviteModal(true)
            }}
            aria-disabled={!canCurrentUser('settings.team')}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Invite Member
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</div>
          <div className="text-xs text-slate-600 dark:text-slate-400">Total Members</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          <div className="text-xs text-slate-600 dark:text-slate-400">Active</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-slate-500">{stats.inactive}</div>
          <div className="text-xs text-slate-600 dark:text-slate-400">Inactive</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-blue-600">{stats.pending}</div>
          <div className="text-xs text-slate-600 dark:text-slate-400">Pending</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | "All")}
          className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="All">All Roles</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_DISPLAY_NAMES[role]}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "All" | "Active" | "Inactive")}
          className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="All">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {/* Team Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {filteredMembers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white">Member</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white">Role</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white">
                    Last Active
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900 dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <tr
                    key={member.id}
                    className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-sm font-bold text-white shadow">
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl || "/placeholder.svg"}
                              alt={member.fullName}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            member.fullName.substring(0, 2).toUpperCase()
                          )}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white">{member.fullName}</span>
                          {member.department && <div className="text-xs text-slate-500">{member.department}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-sm">{member.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleColor(member.role)}`}>
                        {ROLE_DISPLAY_NAMES[member.role]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${member.status === "active"
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                          : member.status === "invited"
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                          }`}
                      >
                        {member.status === "active" && <CheckCircle className="w-3 h-3 inline mr-1" />}
                        {member.status === "invited" && <Clock className="w-3 h-3 inline mr-1" />}
                        {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                      {member.lastActiveAt ? new Date(member.lastActiveAt).toLocaleDateString() : "Never"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative">
                        <button
                          onClick={() => setActionMenuId(actionMenuId === member.id ? null : member.id)}
                          className="p-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {actionMenuId === member.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-700 rounded-xl shadow-lg border border-slate-200 dark:border-slate-600 py-2 z-10 min-w-[160px]">
                            <button
                              onClick={() => {
                                if (!canCurrentUser('settings.team')) { useStore.getState().actions.showToast('You do not have permission to edit team roles.', 'error'); setActionMenuId(null); return }
                                setSelectedMember(member)
                                setShowEditModal(true)
                                setActionMenuId(null)
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
                            >
                              <Edit className="w-4 h-4" />
                              Edit Role
                            </button>
                            {member.status === "active" && member.id !== currentUserId && (
                              <button
                                onClick={() => {
                                  if (!canCurrentUser('settings.team')) { useStore.getState().actions.showToast('You do not have permission to deactivate team members.', 'error'); setActionMenuId(null); return }
                                  handleDeactivateMember(member.id)
                                  setActionMenuId(null)
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                              >
                                <Ban className="w-4 h-4" />
                                Deactivate
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">No team members found</p>
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6">
          <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Pending Invitations
          </h3>
          <div className="space-y-3">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-800"
              >
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">{inv.email}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-full ${getRoleColor(inv.role)}`}>
                      {ROLE_DISPLAY_NAMES[inv.role]}
                    </span>
                    <span>Expires {new Date(inv.expiresAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleCancelInvitation(inv.id)}
                  className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Invite Team Member</h3>
              <button
                onClick={() => {
                  setShowInviteModal(false)
                  setInviteError("")
                  setInviteSuccess("")
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {inviteSuccess ? (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Invitation Sent!</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">{inviteSuccess}</p>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    placeholder="colleague@clinic.com"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Role</label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as UserRole })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_DISPLAY_NAMES[role]}
                      </option>
                    ))}
                  </select>
                </div>

                {inviteError && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <span className="text-sm text-red-700 dark:text-red-400">{inviteError}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isInviting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-400 text-white font-semibold rounded-xl transition-colors"
                  >
                    {isInviting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        Send Invitation
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {showEditModal && selectedMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Edit Member Role</h3>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedMember(null)
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-lg font-bold text-white">
                  {selectedMember.fullName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{selectedMember.fullName}</div>
                  <div className="text-sm text-slate-500">{selectedMember.email}</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                  Select New Role
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {ROLES.map((role) => (
                    <button
                      key={role}
                      onClick={() => handleUpdateRole(selectedMember.id, role)}
                      className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all ${selectedMember.role === role
                        ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400"
                        : "border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-700"
                        }`}
                    >
                      {ROLE_DISPLAY_NAMES[role]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TeamManagement

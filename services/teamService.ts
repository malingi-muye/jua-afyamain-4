import { supabase } from '../lib/supabaseClient';
import { TeamMember } from '../types';
import { NEW_ROLE_MAP, LEGACY_ROLE_MAP } from '../types/enterprise';
import type { UserRole } from '../types/enterprise';
import { enterpriseDb } from './enterprise-db';
import logger from '../lib/logger';

export interface InvitationRequest {
  id: string;
  email: string;
  role: string;
  clinicId: string;
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'expired';
}

/**
 * Service for managing team members
 */
export const teamService = {
  /**
   * Fetch all team members for the current user's clinic
   */
  async getTeamMembers(): Promise<TeamMember[]> {
    try {
      // Get current user's session
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        logger.warn('[teamService] No authenticated user');
        return [];
      }

      // Fetch current user's clinic_id from their profile
      const { data: currentUserProfile } = await supabase
        .from('users')
        .select('clinic_id')
        .eq('id', authUser.id)
        .maybeSingle();

      const clinicId = currentUserProfile?.clinic_id;

      // If no clinic_id, just return current user
      if (!clinicId) {
        logger.warn('[teamService] User has no clinic_id, returning only current user');
        // Return current user as sole team member
        const { data: profile } = await supabase
          .from('users')
          .select('id, clinic_id, full_name, email, phone, role, status, last_active_at, avatar_url')
          .eq('id', authUser.id)
          .single();

        if (profile) {
          return [mapUserToTeamMember(profile)];
        }
        return [];
      }

      // Fetch all users from the same clinic
      const { data: users, error } = await supabase
        .from('users')
        .select('id, clinic_id, full_name, email, phone, role, status, last_active_at, avatar_url')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[teamService] Error fetching team members:', error);
        return [];
      }

      // 1. Map users to TeamMember format
      const teamMembers: TeamMember[] = (users || []).map(mapUserToTeamMember);

      // 2. Fetch pending invitations and merge them
      try {
        const invitations = await enterpriseDb.getInvitations();
        const invitedMembers: TeamMember[] = invitations.map(inv => ({
          id: inv.id,
          name: inv.email.split('@')[0],
          email: inv.email,
          role: inv.role as any,
          status: 'Invited',
          lastActive: 'Never',
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(inv.email)}&background=CBD5E1&color=64748B`,
        }));

        // Merge and avoid duplicates if any (though invitations table is separate)
        return [...teamMembers, ...invitedMembers];
      } catch (invError) {
        logger.warn('[teamService] Could not fetch invitations:', invError);
        return teamMembers;
      }
    } catch (error) {
      console.error('[teamService] Error loading team members:', error);
      return [];
    }
  },

  /**
   * Get a single team member by ID
   */
  async getTeamMember(userId: string): Promise<TeamMember | null> {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, clinic_id, full_name, email, phone, role, status, last_active_at, avatar_url')
        .eq('id', userId)
        .single();

      if (error || !user) {
        console.error('[teamService] Error fetching team member:', error);
        return null;
      }

      return mapUserToTeamMember(user);
    } catch (error) {
      console.error('[teamService] Error loading team member:', error);
      return null;
    }
  },

  /**
   * Update team member
   */
  async updateTeamMember(member: Partial<TeamMember>): Promise<boolean> {
    try {
      if (!member.id) {
        throw new Error('Team member ID is required');
      }

      const updates: any = {};
      if (member.name) updates.full_name = member.name;
      if (member.email) updates.email = member.email;
      if (member.phone) updates.phone = member.phone;
      if (member.role) {
        // Convert from legacy role to enterprise role
        const enterpriseRole = Object.entries(NEW_ROLE_MAP).find(
          ([_, legacyRole]) => legacyRole === member.role
        )?.[0];
        if (enterpriseRole) updates.role = enterpriseRole;
      }
      if (member.status) updates.status = member.status.toLowerCase();

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', member.id);

      if (error) {
        console.error('[teamService] Error updating team member:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[teamService] Error updating team member:', error);
      return false;
    }
  },

  /**
   * Invite a new team member
   */
  async inviteTeamMember(email: string, role: string, invitedBy: string): Promise<InvitationRequest> {
    try {
      // Use enterpriseDb for real invitation logic
      const result = await enterpriseDb.createInvitation(email, role as any);

      if (!result) {
        throw new Error('Failed to create invitation');
      }

      return {
        id: result.id,
        email: result.email,
        role: result.role,
        clinicId: result.clinicId,
        invitedBy: result.invitedBy || invitedBy,
        invitedAt: result.createdAt,
        expiresAt: result.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: (result.status as any) || 'pending',
      };
    } catch (error) {
      console.error('[teamService] Error inviting member:', error);
      throw error;
    }
  },
};

/**
 * Helper function to map Supabase user to TeamMember
 */
function mapUserToTeamMember(user: any): TeamMember {
  const dbRole = user.role as string;
  const capitalizedRole = LEGACY_ROLE_MAP[dbRole] || LEGACY_ROLE_MAP[dbRole.toLowerCase()] || dbRole || 'Doctor';

  return {
    id: user.id || Math.random().toString(36).substring(7),
    clinicId: user.clinic_id || undefined,
    name: user.full_name || user.email?.split('@')[0] || 'User',
    email: user.email || '',
    phone: user.phone || undefined,
    role: capitalizedRole as any,
    status: user.status === 'active' ? 'Active' : user.status === 'suspended' ? 'Deactivated' : 'Invited',
    lastActive: formatLastActive(user.last_active_at),
    avatar: user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || user.email || 'User')}&background=3462EE&color=fff`,
  };
}

/**
 * Helper to format last active time
 */
function formatLastActive(lastActiveAt: string | null): string {
  if (!lastActiveAt) return 'Never';

  const now = new Date();
  const lastActive = new Date(lastActiveAt);
  const diffMs = now.getTime() - lastActive.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return lastActive.toLocaleDateString();
}

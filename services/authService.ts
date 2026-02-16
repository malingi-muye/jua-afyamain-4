import { supabase } from '../lib/supabaseClient';
import { sessionManager } from '../lib/sessionManager';
import { validation } from '../lib/validation';
import { TeamMember } from '../types';

export const authService = {
  /**
   * Login with email and password
   * Enforces minimum security requirements
   */
  async login(email: string, password: string): Promise<TeamMember> {
    // Input validation
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    if (!validation.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    if (!password || password.length === 0) {
      throw new Error('Password is required');
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error('Login failed: No user data returned');
      }

      return constructTeamMember(data.user);
    } catch (err: any) {
      console.error('Login error:', err);
      throw new Error('Invalid email or password');
    }
  },

  /**
   * Sign up a new user
   * Only allowed if registration is enabled
   */
  async signup(
    email: string,
    password: string,
    fullName: string,
    clinicName?: string
  ): Promise<TeamMember> {
    // Input validation
    if (!email || !password || !fullName) {
      throw new Error('Email, password, and full name are required');
    }

    if (!validation.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    if (!validation.isStrongPassword(password)) {
      const feedback = validation.getPasswordStrengthFeedback(password);
      throw new Error(`Password requirements: ${feedback.feedback.join(', ')}`);
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            clinic_name: clinicName?.trim(),
            role: 'admin',
          },
        },
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error('Signup failed: No user data returned');
      }

      return constructTeamMember(data.user);
    } catch (err: any) {
      console.error('Signup error:', err);
      throw new Error(err.message || 'Failed to create account');
    }
  },

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // Clear session metadata
      sessionManager.clearSession();
    } catch (err) {
      console.error('Logout error:', err);
      sessionManager.clearSession();
      throw new Error('Failed to logout');
    }
  },

  /**
   * Get current session
   */
  async getSession() {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    } catch (err) {
      console.error('Session error:', err);
      return null;
    }
  },

  /**
   * Change password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    if (!currentPassword || !newPassword) {
      throw new Error('Current and new password are required');
    }

    if (!validation.isStrongPassword(newPassword)) {
      const feedback = validation.getPasswordStrengthFeedback(newPassword);
      throw new Error(`Password requirements: ${feedback.feedback.join(', ')}`);
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    } catch (err: any) {
      console.error('Password change error:', err);
      throw new Error(err.message || 'Failed to change password');
    }
  },

  /**
   * Reset password
   */
  async resetPassword(email: string): Promise<void> {
    if (!validation.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );
      if (error) throw error;
    } catch (err: any) {
      console.error('Password reset error:', err);
      throw new Error(err.message || 'Failed to send reset email');
    }
  },

  /**
   * Verify email with token
   * Note: email parameter is required by Supabase verifyOtp API
   */
  async verifyEmail(email: string, token: string): Promise<void> {
    if (!email || !token) {
      throw new Error('Email and verification token are required');
    }

    if (!validation.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: 'email',
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Email verification error:', err);
      throw new Error('Invalid or expired verification token');
    }
  },
};

import { LEGACY_ROLE_MAP } from '../types/enterprise';

/**
 * Helper: Construct TeamMember from Supabase user
 */
function constructTeamMember(user: any): TeamMember {
  const rawRole = user.user_metadata?.role || 'Doctor';
  const normalizedRole = LEGACY_ROLE_MAP[rawRole] || LEGACY_ROLE_MAP[rawRole.toLowerCase()] || rawRole;

  return {
    id: user.id,
    name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
    email: user.email || '',
    role: normalizedRole as any,
    status: 'Active',
    lastActive: new Date().toISOString(),
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || 'User')}`,
  };
}

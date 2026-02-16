/**
 * Session Manager - Handles session lifecycle and refresh logic
 * 
 * NOTE: Tokens are now managed by Supabase via HttpOnly secure cookies.
 * This manager only tracks session validity in memory, not tokens.
 * This removes XSS vulnerability from localStorage token storage.
 */

interface SessionData {
  userId: string;
  email: string;
  isValid: boolean;
}

export class SessionManager {
  private session: SessionData | null = null;
  private listeners: Array<(isValid: boolean) => void> = [];

  constructor() {
    this.initializeSession();
  }

  /**
   * Initialize session from Supabase auth state
   */
  private initializeSession(): void {
    // Session state is managed by Supabase via cookies
    // This class only tracks whether a session exists, not the tokens
    this.session = null;
  }

  /**
   * Set session (called after successful auth)
   * Tokens are stored in HttpOnly cookies by Supabase, not here
   */
  setSession(userId: string, email: string): void {
    this.session = {
      userId,
      email,
      isValid: true,
    };
    this.notifyListeners(true);
  }

  /**
   * Get current session data (NO TOKENS - only metadata)
   */
  getSession(): SessionData | null {
    return this.session;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.session !== null && this.session.isValid;
  }

  /**
   * Clear session
   * Token invalidation happens on server via Supabase signOut
   */
  clearSession(): void {
    this.session = null;
    this.notifyListeners(false);
  }

  /**
   * Subscribe to session changes
   */
  onSessionChange(listener: (isValid: boolean) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Notify all listeners of session change
   */
  private notifyListeners(isValid: boolean): void {
    this.listeners.forEach((listener) => {
      try {
        listener(isValid);
      } catch (err) {
        console.error('Error in session listener:', err);
      }
    });
  }

  /**
   * Logout and clear session
   */
  logout(): void {
    this.clearSession();
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();

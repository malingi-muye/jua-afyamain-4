import { supabase } from '../lib/supabaseClient';
import logger from '../lib/logger';

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'PATIENT_CREATE'
  | 'PATIENT_UPDATE'
  | 'PATIENT_DELETE'
  | 'APPOINTMENT_CREATE'
  | 'APPOINTMENT_UPDATE'
  | 'APPOINTMENT_CANCEL'
  | 'INVENTORY_CREATE'
  | 'INVENTORY_UPDATE'
  | 'INVENTORY_DELETE'
  | 'PRESCRIPTION_DISPENSE'
  | 'VISIT_START'
  | 'VISIT_UPDATE'
  | 'VISIT_COMPLETE'
  | 'PAYMENT_PROCESS'
  | 'REPORT_GENERATE'
  | 'SETTINGS_UPDATE'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_DELETE'
  | 'SMS_SEND'
  | 'EMAIL_SEND'
  | 'DATA_EXPORT'
  | 'DATA_IMPORT'
  | 'BACKUP_CREATE'
  | 'BACKUP_RESTORE';

export interface AuditLog {
  id?: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  resourceName?: string;
  changes?: Record<string, { old: any; new: any }>;
  ipAddress?: string;
  userAgent?: string;
  status: 'Success' | 'Failed';
  errorMessage?: string;
  metadata?: Record<string, any>;
}

class AuditLogger {
  private logs: AuditLog[] = [];
  private maxLocalLogs = 1000;

  constructor() {
    this.loadLogsFromStorage();
  }

  /**
   * Log an action
   */
  async log(
    userId: string,
    userName: string,
    action: AuditAction,
    resourceType: string,
    resourceId: string,
    options: {
      resourceName?: string;
      changes?: Record<string, { old: any; new: any }>;
      status?: 'Success' | 'Failed';
      errorMessage?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    const auditLog: AuditLog = {
      timestamp: new Date().toISOString(),
      userId,
      userName,
      action,
      resourceType,
      resourceId,
      resourceName: options.resourceName,
      changes: options.changes,
      ipAddress: await this.getIpAddress(),
      userAgent: navigator.userAgent,
      status: options.status || 'Success',
      errorMessage: options.errorMessage,
      metadata: options.metadata,
    };

    // Add to local logs
    this.logs.unshift(auditLog);
    if (this.logs.length > this.maxLocalLogs) {
      this.logs.pop();
    }
    this.saveLogsToStorage();

    // Try to persist to database
    try {
      await this.persistToDatabase(auditLog);
    } catch (err) {
      logger.warn('Failed to persist audit log to database:', err);
      // Don't throw - local logging is critical, database is secondary
    }
  }

  /**
   * Get audit logs with filtering
   */
  async getLogs(filters: {
    userId?: string;
    action?: AuditAction;
    resourceType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}): Promise<AuditLog[]> {
    let results = [...this.logs];

    if (filters.userId) {
      results = results.filter((log) => log.userId === filters.userId);
    }

    if (filters.action) {
      results = results.filter((log) => log.action === filters.action);
    }

    if (filters.resourceType) {
      results = results.filter((log) => log.resourceType === filters.resourceType);
    }

    if (filters.startDate) {
      results = results.filter((log) => log.timestamp >= filters.startDate!);
    }

    if (filters.endDate) {
      results = results.filter((log) => log.timestamp <= filters.endDate!);
    }

    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  /**
   * Get logs for a specific resource
   */
  async getResourceHistory(resourceType: string, resourceId: string): Promise<AuditLog[]> {
    return this.logs.filter(
      (log) => log.resourceType === resourceType && log.resourceId === resourceId
    );
  }

  /**
   * Get user activity timeline
   */
  async getUserActivity(userId: string, days: number = 30): Promise<AuditLog[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.logs.filter(
      (log) =>
        log.userId === userId && new Date(log.timestamp) >= startDate
    );
  }

  /**
   * Export logs for compliance
   */
  async exportLogs(format: 'json' | 'csv' = 'json'): Promise<string> {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    }

    // CSV format
    const headers = [
      'Timestamp',
      'User',
      'Action',
      'Resource Type',
      'Resource ID',
      'Status',
      'Error',
    ];
    const rows = this.logs.map((log) => [
      log.timestamp,
      log.userName,
      log.action,
      log.resourceType,
      log.resourceId,
      log.status,
      log.errorMessage || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    return csv;
  }

  /**
   * Clear old logs (for storage management)
   */
  clearOldLogs(daysToKeep: number = 90): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    this.logs = this.logs.filter(
      (log) => new Date(log.timestamp) > cutoffDate
    );
    this.saveLogsToStorage();
  }

  /**
   * Private: Save logs to localStorage
   */
  private saveLogsToStorage(): void {
    try {
      localStorage.setItem('juaafya_audit_logs', JSON.stringify(this.logs.slice(0, 500)));
    } catch (err) {
      logger.warn('Failed to save audit logs to localStorage:', err);
    }
  }

  /**
   * Private: Load logs from localStorage
   */
  private loadLogsFromStorage(): void {
    try {
      const stored = localStorage.getItem('juaafya_audit_logs');
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (err) {
      logger.warn('Failed to load audit logs from localStorage:', err);
    }
  }

  private async asyncGetClinicId(): Promise<string | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from('users')
        .select('clinic_id')
        .eq('id', user.id)
        .maybeSingle();

      return profile?.clinic_id || null;
    } catch {
      return null;
    }
  }

  /**
   * Private: Persist log to database
   */
  private async persistToDatabase(log: AuditLog): Promise<void> {
    try {
      const clinicId = await this.asyncGetClinicId();

      const { error } = await supabase.from('audit_logs').insert({
        clinic_id: clinicId,
        user_id: log.userId,
        user_email: log.userName.includes('@') ? log.userName : undefined,
        user_name: log.userName,
        user_role: log.metadata?.role || undefined,
        action: log.action,
        resource_type: log.resourceType,
        resource_id: log.resourceId,
        resource_name: log.resourceName,
        old_values: log.changes ? Object.fromEntries(Object.entries(log.changes).map(([k, v]) => [k, v.old])) : undefined,
        new_values: log.changes ? Object.fromEntries(Object.entries(log.changes).map(([k, v]) => [k, v.new])) : undefined,
        ip_address: log.ipAddress,
        user_agent: log.userAgent,
        status: log.status,
        metadata: log.metadata,
      });

      if (error) throw error;
    } catch (err) {
      console.error('Error persisting audit log:', err);
      throw err;
    }
  }

  /**
   * Private: Get client IP address
   */
  private async getIpAddress(): Promise<string | undefined> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return undefined;
    }
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();

/**
 * Helper function to log with try-catch handling
 */
export async function logAction(
  userId: string,
  userName: string,
  action: AuditAction,
  resourceType: string,
  resourceId: string,
  options?: Parameters<typeof auditLogger.log>[5]
): Promise<void> {
  try {
    await auditLogger.log(userId, userName, action, resourceType, resourceId, options);
  } catch (err) {
    console.error('Error logging action:', err);
  }
}

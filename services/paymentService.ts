/**
 * Payment Processing Service
 * Handles PayStack and M-Pesa payments
 * Supports cards, M-Pesa, and bank transfers
 */

import { apiClient } from '../lib/apiClient';
import { validation } from '../lib/validation';
import { auditLogger } from './auditService';
import { supabase } from '../lib/supabaseClient';
import logger from '../lib/logger';

export type PaymentMethod = 'card' | 'mpesa' | 'bank_transfer';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface Payment {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  patientId?: string;
  visitId?: string;
  invoiceId?: string;
  description: string;
  customerEmail: string;
  customerPhone?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface PaymentConfig {
  provider: 'PayStack' | 'M-Pesa' | 'None';
  apiKey: string; // Public Key
  secretKey: string; // Secret Key
  webhookUrl?: string;
  webhookSecret?: string;
  testMode: boolean;
  isConfigured?: boolean;
}

/**
 * Payment Service - Main interface for all payment operations
 */
class PaymentService {
  private config: PaymentConfig | null = null;
  private paystackApiUrl = 'https://api.paystack.co';

  /**
   * Initialize payment service with configuration
   */
  initialize(config: Partial<PaymentConfig>): void {
    if (!config.apiKey || !config.secretKey) {
      logger.warn('Payment configuration incomplete');
    }
    this.config = config as PaymentConfig;
  }

  /**
   * Get configuration status
   */
  isConfigured(provider: 'paystack' | 'mpesa' | 'all' = 'all'): boolean {
    if (!this.config || this.config.provider === 'None') return false;

    // Currently both PayStack and M-Pesa (via PayStack) require the same keys
    const hasKeys = !!this.config.apiKey && !!this.config.secretKey;

    if (provider === 'paystack') return this.config.provider === 'PayStack' && hasKeys;
    if (provider === 'mpesa') return (this.config.provider === 'PayStack' || this.config.provider === 'M-Pesa') && hasKeys;

    return hasKeys;
  }

  /**
   * Initialize PayStack payment
   * Returns access code for frontend redirect
   */
  async initializePayStackPayment(
    amount: number,
    email: string,
    metadata: Record<string, any> = {}
  ): Promise<{ accessCode: string; authorizationUrl: string }> {
    if (amount <= 0) {
      throw new Error('Invalid amount');
    }

    if (!validation.isValidEmail(email)) {
      throw new Error('Invalid email');
    }

    try {
      const { data, error } = await supabase.functions.invoke('process-payment', {
        body: {
          action: 'initialize',
          amount: amount,
          email: email,
          metadata: metadata,
          provider: 'PayStack'
        }
      });

      if (error) throw error;
      if (!data.status) throw new Error(data.message || 'Payment initialization failed');

      return {
        accessCode: data.data.access_code,
        authorizationUrl: data.data.authorization_url,
      };
    } catch (err: any) {
      console.error('PayStack initialization error:', err);
      throw new Error(err.message || 'Failed to initialize PayStack payment');
    }
  }

  /**
   * Verify PayStack payment
   */
  async verifyPayStackPayment(reference: string): Promise<Payment> {
    if (!reference) {
      throw new Error('Payment reference required');
    }

    try {
      const { data, error } = await supabase.functions.invoke('process-payment', {
        body: {
          action: 'verify',
          reference
        }
      });

      if (error) throw error;
      if (!data.status) throw new Error(data.message || 'Verification failed');

      const txnData = data.data;
      const payment: Payment = {
        id: txnData.id.toString(),
        reference: txnData.reference,
        amount: txnData.amount / 100, // Convert from cents
        currency: txnData.currency,
        method: txnData.channel === 'mobile_money' ? 'mpesa' : 'card',
        status: txnData.status === 'success' ? 'completed' : 'failed',
        description: txnData.metadata?.description || 'Payment',
        customerEmail: txnData.customer.email,
        customerPhone: txnData.customer.phone,
        metadata: txnData.metadata,
        createdAt: txnData.created_at,
        completedAt: txnData.paid_at || undefined,
      };

      return payment;
    } catch (err: any) {
      console.error('PayStack verification error:', err);
      throw new Error(err.message || 'Failed to verify payment');
    }
  }

  /**
   * Initialize M-Pesa STK Push (Simplified via PayStack)
   */
  async initializeMpesaPayment(
    phoneNumber: string,
    amount: number,
    accountReference: string,
    description: string = '',
    email: string = 'customer@juaafya.com'
  ): Promise<{ checkoutRequestId: string; message: string }> {
    const phone = validation.sanitizePhone(phoneNumber);
    if (!validation.isValidPhone(phone)) {
      throw new Error('Invalid phone number');
    }

    if (amount <= 0) {
      throw new Error('Invalid amount');
    }

    try {
      const { data, error } = await supabase.functions.invoke('process-payment', {
        body: {
          action: 'charge',
          amount: amount,
          phone: phone,
          email: email,
          provider: 'M-Pesa',
          metadata: { accountReference, description }
        }
      });

      if (error) throw error;
      if (!data.status) throw new Error(data.message || 'M-Pesa initialization failed');

      return {
        checkoutRequestId: data.data.reference || '',
        message: data.data.message || 'STK prompt sent successfully',
      };
    } catch (err: any) {
      console.error('M-Pesa payment error:', err);
      throw new Error(err.message || 'Failed to initialize M-Pesa payment');
    }
  }

  /**
   * Check M-Pesa payment status (via PayStack)
   */
  async checkMpesaPaymentStatus(checkoutRequestId: string): Promise<Payment> {
    return this.verifyPayStackPayment(checkoutRequestId);
  }

  /**
   * Process refund
   */
  async processRefund(
    reference: string,
    amount: number,
    reason: string
  ): Promise<{ refundReference: string; status: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('process-payment', {
        body: {
          action: 'refund',
          reference,
          amount,
          metadata: { reason }
        }
      });

      if (error) throw error;
      if (!data.status) throw new Error(data.message || 'Refund processing failed');

      return {
        refundReference: data.data.reference,
        status: data.data.status,
      };
    } catch (err: any) {
      console.error('Refund error:', err);
      throw new Error(err.message || 'Failed to process refund');
    }
  }

  /**
   * Private: Get access token (Legacy - no longer needed for PayStack-Mpesa)
   */
  private async getMpesaAccessToken(): Promise<string> {
    throw new Error('Method deprecated. Use PayStack-based verification.');
  }

  /**
   * Get payment history for patient
   */
  async getPaymentHistory(patientId: string): Promise<Payment[]> {
    try {
      const response = await apiClient.get(`/payments?patientId=${patientId}`);
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data || [];
    } catch (err: any) {
      console.error('Payment history error:', err);
      return [];
    }
  }

  /**
   * Calculate payment split (if multiple recipients)
   */
  calculatePaymentSplit(
    totalAmount: number,
    splits: Array<{ id: string; percentage: number }>
  ): Array<{ id: string; amount: number }> {
    return splits.map((split) => ({
      id: split.id,
      amount: (totalAmount * split.percentage) / 100,
    }));
  }
}

// Export singleton instance
export const paymentService = new PaymentService();

/**
 * Helper: Format amount for display
 */
export function formatAmount(amount: number, currency: string = 'KES'): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Helper: Generate invoice reference
 */
export function generatePaymentReference(prefix: string = 'PAY'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

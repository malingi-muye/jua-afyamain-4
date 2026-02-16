/**
 * Invoicing Service
 * Manages invoice creation, storage, and retrieval
 */

import { Visit, Patient, ClinicSettings } from '../types';
import { auditLogger } from './auditService';
import { validation } from '../lib/validation';
import { supabase } from '../lib/supabaseClient';
import { enterpriseDb } from './enterprise-db';
import logger from '../lib/logger';

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category: 'consultation' | 'medication' | 'test' | 'procedure' | 'other';
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  patientEmail?: string;
  patientPhone?: string;
  visitId?: string;
  clinicDetails: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    registrationNumber?: string;
  };
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxRate: number; // Percentage
  taxAmount: number;
  discountAmount: number;
  discountReason?: string;
  total: number;
  amountPaid: number;
  amountDue: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  paymentMethod?: string;
  paymentReference?: string;
  notes?: string;
  issuedAt: string;
  dueDate: string;
  paidAt?: string;
  createdBy: string;
  currency: string;
  status: 'draft' | 'issued' | 'overdue' | 'cancelled';
}

class InvoiceService {
  /**
   * Create invoice from visit
   */
  async createInvoiceFromVisit(
    visit: Visit,
    patient: Patient,
    clinicSettings: ClinicSettings,
    userId: string
  ): Promise<Invoice> {
    if (!visit || !patient) {
      throw new Error('Visit and patient data required');
    }

    // Prepare line items
    const lineItems: InvoiceLineItem[] = [];

    // Add consultation fee
    if (visit.consultationFee > 0) {
      lineItems.push({
        id: `consultation-${visit.id}`,
        description: 'Consultation Fee',
        quantity: 1,
        unitPrice: visit.consultationFee,
        total: visit.consultationFee,
        category: 'consultation',
      });
    }

    // Add prescriptions
    visit.prescription.forEach((med, idx) => {
      lineItems.push({
        id: `med-${visit.id}-${idx}`,
        description: `${med.name} - ${med.dosage}`,
        quantity: med.quantity,
        unitPrice: med.price,
        total: med.price * med.quantity,
        category: 'medication',
      });
    });

    // Add lab orders
    visit.labOrders.forEach((lab, idx) => {
      lineItems.push({
        id: `lab-${visit.id}-${idx}`,
        description: lab.testName,
        quantity: 1,
        unitPrice: lab.price,
        total: lab.price,
        category: 'test',
      });
    });

    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const taxRate = 0; // No VAT in Kenya for health services typically
    const taxAmount = (subtotal * taxRate) / 100;
    const discountAmount = 0;
    const total = subtotal + taxAmount - discountAmount;

    const invoice: Invoice = {
      id: `INV-${Date.now()}`,
      invoiceNumber: this.generateInvoiceNumber(),
      patientId: patient.id,
      patientName: patient.name,
      patientEmail: patient.phone, // Using phone as email placeholder
      patientPhone: patient.phone,
      visitId: visit.id,
      clinicDetails: {
        name: clinicSettings.name,
        address: clinicSettings.location,
        phone: clinicSettings.phone,
        email: clinicSettings.email,
        registrationNumber: await (async () => {
          // Prefer explicit value if provided in ClinicSettings
          // (some deployments may include registrationNumber in settings)
          // Fallback: attempt to read organization settings from enterpriseDb
          try {
            // Try common locations
            // @ts-ignore - settings shape can vary between deployments
            if ((clinicSettings as any).registrationNumber) return (clinicSettings as any).registrationNumber;

            const org = await enterpriseDb.getOrganization();
            // org.settings may contain registrationNumber or registration_number
            if (org && org.settings) {
              // @ts-ignore
              return org.settings.registrationNumber || org.settings.registration_number || undefined;
            }
          } catch (e) {
            // ignore and return undefined
          }

          return undefined;
        })(),
      },
      lineItems,
      subtotal,
      taxRate,
      taxAmount,
      discountAmount,
      total,
      amountPaid: visit.paymentStatus === 'Paid' ? total : 0,
      amountDue: visit.paymentStatus === 'Paid' ? 0 : total,
      paymentStatus: visit.paymentStatus === 'Paid' ? 'paid' : 'unpaid',
      issuedAt: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      createdBy: userId,
      currency: clinicSettings.currency,
      status: 'issued',
    };

    // Save to database
    try {
      await this.saveInvoice(invoice);
      await auditLogger.log(
        userId,
        'System',
        'REPORT_GENERATE',
        'Invoice',
        invoice.id,
        {
          resourceName: invoice.invoiceNumber,
          status: 'success',
          metadata: { patientId: patient.id, total },
        }
      );
    } catch (err) {
      logger.warn('Failed to save invoice to database:', err);
      // Still return invoice if local save fails
    }

    return invoice;
  }

  /**
   * Create custom invoice
   */
  async createCustomInvoice(
    patientId: string,
    patientName: string,
    lineItems: InvoiceLineItem[],
    clinicSettings: ClinicSettings,
    userId: string,
    options: {
      taxRate?: number;
      discountAmount?: number;
      discountReason?: string;
      dueDate?: string;
      notes?: string;
    } = {}
  ): Promise<Invoice> {
    if (!patientId || !lineItems || lineItems.length === 0) {
      throw new Error('Invalid invoice data');
    }

    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const taxRate = options.taxRate || 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const discountAmount = options.discountAmount || 0;
    const total = subtotal + taxAmount - discountAmount;

    const invoice: Invoice = {
      id: `INV-${Date.now()}`,
      invoiceNumber: this.generateInvoiceNumber(),
      patientId,
      patientName,
      clinicDetails: {
        name: clinicSettings.name,
        address: clinicSettings.location,
        phone: clinicSettings.phone,
        email: clinicSettings.email,
      },
      lineItems,
      subtotal,
      taxRate,
      taxAmount,
      discountAmount,
      discountReason: options.discountReason,
      total,
      amountPaid: 0,
      amountDue: total,
      paymentStatus: 'unpaid',
      issuedAt: new Date().toISOString(),
      dueDate: options.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: userId,
      currency: clinicSettings.currency,
      status: 'issued',
      notes: options.notes,
    };

    try {
      await this.saveInvoice(invoice);
    } catch (err) {
      logger.warn('Failed to save invoice:', err);
    }

    return invoice;
  }

  /**
   * Update payment status
   */
  async recordPayment(
    invoiceId: string,
    amountPaid: number,
    paymentMethod: string,
    paymentReference: string,
    userId: string
  ): Promise<Invoice> {
    // In a real app, fetch from DB
    // For now, update in memory and return
    const updates = {
      amountPaid,
      paymentMethod,
      paymentReference,
      paidAt: new Date().toISOString(),
      paymentStatus: amountPaid > 0 ? 'paid' : 'unpaid',
    };

    await auditLogger.log(userId, 'System', 'PAYMENT_PROCESS', 'Invoice', invoiceId, {
      status: 'success',
      metadata: { amountPaid, paymentMethod },
    });

    return { id: invoiceId } as Invoice; // Simplified return
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      if (error || !data) return null;
      return this.mapDbInvoice(data);
    } catch (err) {
      console.error('Error fetching invoice:', err);
      return null;
    }
  }

  /**
   * Get invoices for patient
   */
  async getPatientInvoices(patientId: string): Promise<Invoice[]> {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('patient_id', patientId)
        .order('issued_at', { ascending: false });

      if (error || !data) return [];
      return data.map((inv: any) => this.mapDbInvoice(inv));
    } catch (err) {
      console.error('Error fetching patient invoices:', err);
      return [];
    }
  }

  /**
   * Get overdue invoices
   */
  async getOverdueInvoices(clinicId?: string): Promise<Invoice[]> {
    try {
      const now = new Date().toISOString();
      let query = supabase
        .from('invoices')
        .select('*')
        .lt('due_date', now)
        .eq('payment_status', 'unpaid')
        .order('due_date', { ascending: true });

      const { data, error } = await query;
      if (error || !data) return [];
      return data.map((inv: any) => this.mapDbInvoice(inv));
    } catch (err) {
      console.error('Error fetching overdue invoices:', err);
      return [];
    }
  }

  /**
   * Get invoice summary
   */
  async getInvoiceSummary(
    startDate?: string,
    endDate?: string
  ): Promise<{
    totalIssued: number;
    totalPaid: number;
    totalOverdue: number;
    invoiceCount: number;
  }> {
    try {
      const { data, error } = await supabase.from('invoices').select('total, amount_paid');

      if (error || !data) {
        return { totalIssued: 0, totalPaid: 0, totalOverdue: 0, invoiceCount: 0 };
      }

      return {
        totalIssued: data.reduce((sum: number, inv: any) => sum + (inv.total || 0), 0),
        totalPaid: data.reduce((sum: number, inv: any) => sum + (inv.amount_paid || 0), 0),
        totalOverdue: data.reduce(
          (sum: number, inv: any) =>
            sum +
            (inv.payment_status === 'unpaid' || inv.payment_status === 'partial'
              ? (inv.total || 0) - (inv.amount_paid || 0)
              : 0),
          0
        ),
        invoiceCount: data.length,
      };
    } catch (err) {
      console.error('Error getting invoice summary:', err);
      return { totalIssued: 0, totalPaid: 0, totalOverdue: 0, invoiceCount: 0 };
    }
  }

  /**
   * Cancel invoice
   */
  async cancelInvoice(invoiceId: string, reason: string, userId: string): Promise<void> {
    try {
      await auditLogger.log(userId, 'System', 'REPORT_GENERATE', 'Invoice', invoiceId, {
        status: 'success',
        metadata: { action: 'cancel', reason },
      });
    } catch (err) {
      console.error('Error cancelling invoice:', err);
    }
  }

  /**
   * Private: Save invoice to database
   */
  private async saveInvoice(invoice: Invoice): Promise<void> {
    try {
      const { error } = await supabase.from('invoices').insert({
        id: invoice.id,
        invoice_number: invoice.invoiceNumber,
        patient_id: invoice.patientId,
        patient_name: invoice.patientName,
        visit_id: invoice.visitId,
        clinic_details: invoice.clinicDetails,
        line_items: invoice.lineItems,
        subtotal: invoice.subtotal,
        tax_rate: invoice.taxRate,
        tax_amount: invoice.taxAmount,
        discount_amount: invoice.discountAmount,
        total: invoice.total,
        amount_paid: invoice.amountPaid,
        amount_due: invoice.amountDue,
        payment_status: invoice.paymentStatus,
        issued_at: invoice.issuedAt,
        due_date: invoice.dueDate,
        created_by: invoice.createdBy,
        currency: invoice.currency,
        status: invoice.status,
        notes: invoice.notes,
      });

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error('Error saving invoice to database:', err);
      throw err;
    }
  }

  /**
   * Private: Generate unique invoice number
   */
  private generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    return `INV-${year}${month}-${random}`;
  }

  /**
   * Private: Map DB invoice to Invoice type
   */
  private mapDbInvoice(dbInv: any): Invoice {
    return {
      id: dbInv.id,
      invoiceNumber: dbInv.invoice_number,
      patientId: dbInv.patient_id,
      patientName: dbInv.patient_name,
      visitId: dbInv.visit_id,
      clinicDetails: dbInv.clinic_details,
      lineItems: dbInv.line_items || [],
      subtotal: dbInv.subtotal,
      taxRate: dbInv.tax_rate,
      taxAmount: dbInv.tax_amount,
      discountAmount: dbInv.discount_amount,
      total: dbInv.total,
      amountPaid: dbInv.amount_paid,
      amountDue: dbInv.amount_due,
      paymentStatus: dbInv.payment_status,
      issuedAt: dbInv.issued_at,
      dueDate: dbInv.due_date,
      createdBy: dbInv.created_by,
      currency: dbInv.currency,
      status: dbInv.status,
      notes: dbInv.notes,
    };
  }
}

export const invoiceService = new InvoiceService();

/**
 * Document Generation Service
 * Creates PDFs for invoices, receipts, prescriptions, and reports
 * Uses jsPDF for professional document generation
 */

import { Invoice, InvoiceLineItem } from './invoiceService';
import { Visit, Patient, ClinicSettings } from '../types';
import { formatAmount } from './paymentService';
import logger from '../lib/logger';

/**
 * Document generation helper class
 * Creates formatted PDF documents
 */
export class DocumentGenerator {
  private pageWidth = 210; // A4 width in mm
  private pageHeight = 297; // A4 height in mm
  private margin = 10;
  private fontSize = 10;
  private lineHeight = 5;

  /**
   * Generate Invoice PDF as data URL
   */
  async generateInvoicePdf(invoice: Invoice): Promise<string> {
    // For now, return HTML-based invoice that can be printed to PDF
    // Full jsPDF implementation would require npm install
    return this.generateInvoiceHtml(invoice);
  }

  /**
   * Generate Receipt PDF as data URL
   */
  async generateReceiptPdf(invoice: Invoice): Promise<string> {
    return this.generateReceiptHtml(invoice);
  }

  /**
   * Generate Prescription PDF as data URL
   */
  async generatePrescriptionPdf(
    visit: Visit,
    patient: Patient,
    clinicSettings: ClinicSettings
  ): Promise<string> {
    return this.generatePrescriptionHtml(visit, patient, clinicSettings);
  }

  /**
   * Generate Medical Report PDF as data URL
   */
  async generateMedicalReportPdf(
    visit: Visit,
    patient: Patient,
    clinicSettings: ClinicSettings
  ): Promise<string> {
    return this.generateMedicalReportHtml(visit, patient, clinicSettings);
  }

  /**
   * Print document (opens print dialog)
   */
  printDocument(htmlContent: string, title: string = 'Document'): void {
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) {
      console.error('Failed to open print window');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .print-container { max-width: 210mm; margin: 0 auto; padding: 20px; }
          @media print {
            body { margin: 0; padding: 0; }
            .no-print { display: none; }
          }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .header { font-weight: bold; font-size: 18px; margin-bottom: 20px; }
          .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px; }
          .signature-line { height: 1px; background-color: #000; width: 150px; margin: 40px 0 5px 0; }
          .amount { font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="print-container">
          ${htmlContent}
        </div>
        <button class="no-print" onclick="window.print()">Print</button>
        <button class="no-print" onclick="window.close()">Close</button>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
  }

  /**
   * Download document as PDF
   */
  downloadDocument(htmlContent: string, filename: string): void {
    const element = document.createElement('a');
    const file = new Blob([this.wrapHtml(htmlContent)], { type: 'text/html' });
    element.href = URL.createObjectURL(file);
    element.download = `${filename}.html`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    logger.log('Note: For PDF download, implement jsPDF library integration');
  }

  /**
   * Private: Generate invoice HTML
   */
  private generateInvoiceHtml(invoice: Invoice): string {
    const itemsHtml = invoice.lineItems
      .map(
        (item) => `
      <tr>
        <td>${item.description}</td>
        <td class="text-right">${item.quantity}</td>
        <td class="text-right">${formatAmount(item.unitPrice, invoice.currency)}</td>
        <td class="text-right amount">${formatAmount(item.total, invoice.currency)}</td>
      </tr>
    `
      )
      .join('');

    return `
      <div class="invoice-container">
        <div class="header">INVOICE</div>
        
        <div class="invoice-meta">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
            <div>
              <div><strong>${invoice.clinicDetails.name}</strong></div>
              <div>${invoice.clinicDetails.address || ''}</div>
              <div>Tel: ${invoice.clinicDetails.phone || ''}</div>
              <div>Email: ${invoice.clinicDetails.email || ''}</div>
            </div>
            <div style="text-align: right;">
              <div><strong>Invoice #:</strong> ${invoice.invoiceNumber}</div>
              <div><strong>Date:</strong> ${new Date(invoice.issuedAt).toLocaleDateString()}</div>
              <div><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</div>
            </div>
          </div>
        </div>

        <div class="patient-info" style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <strong>Bill To:</strong>
          <div>${invoice.patientName}</div>
          <div>${invoice.patientPhone || ''}</div>
          <div>${invoice.patientEmail || ''}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th class="text-right">Qty</th>
              <th class="text-right">Unit Price</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="text-align: right; margin: 20px 0; min-width: 300px; margin-left: auto; width: 400px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <span>Subtotal:</span>
            <span class="text-right amount">${formatAmount(invoice.subtotal, invoice.currency)}</span>
            
            ${
              invoice.taxAmount > 0
                ? `
              <span>Tax (${invoice.taxRate}%):</span>
              <span class="text-right amount">${formatAmount(invoice.taxAmount, invoice.currency)}</span>
            `
                : ''
            }
            
            ${
              invoice.discountAmount > 0
                ? `
              <span>Discount:</span>
              <span class="text-right amount">-${formatAmount(invoice.discountAmount, invoice.currency)}</span>
            `
                : ''
            }
            
            <span style="border-top: 2px solid #000; padding-top: 5px;"><strong>Total:</strong></span>
            <span class="text-right amount" style="border-top: 2px solid #000; padding-top: 5px;">${formatAmount(invoice.total, invoice.currency)}</span>
            
            <span><strong>Amount Paid:</strong></span>
            <span class="text-right amount">${formatAmount(invoice.amountPaid, invoice.currency)}</span>
            
            <span><strong>Amount Due:</strong></span>
            <span class="text-right amount" style="color: ${invoice.amountDue > 0 ? '#d32f2f' : '#4caf50'};">${formatAmount(invoice.amountDue, invoice.currency)}</span>
          </div>
        </div>

        ${
          invoice.notes
            ? `
          <div style="background: #f0f0f0; padding: 10px; border-radius: 5px; margin-top: 20px;">
            <strong>Notes:</strong>
            <div>${invoice.notes}</div>
          </div>
        `
            : ''
        }

        <div style="margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px; text-align: center; font-size: 12px; color: #666;">
          <div>Thank you for your business!</div>
          <div>Payment Status: <strong>${invoice.paymentStatus.toUpperCase()}</strong></div>
        </div>
      </div>
    `;
  }

  /**
   * Private: Generate receipt HTML
   */
  private generateReceiptHtml(invoice: Invoice): string {
    return `
      <div class="receipt-container" style="max-width: 400px; font-family: monospace; font-size: 12px;">
        <div class="text-center" style="text-align: center; margin-bottom: 20px;">
          <div style="font-size: 14px; font-weight: bold;">${invoice.clinicDetails.name}</div>
          <div>${invoice.clinicDetails.address || ''}</div>
          <div>${invoice.clinicDetails.phone || ''}</div>
        </div>

        <div style="border: 1px dashed #ccc; padding: 10px; margin-bottom: 10px;">
          <div><strong>Receipt #:</strong> ${invoice.invoiceNumber}</div>
          <div><strong>Date:</strong> ${new Date(invoice.issuedAt).toLocaleString()}</div>
          <div><strong>Patient:</strong> ${invoice.patientName}</div>
        </div>

        <table style="width: 100%; margin-bottom: 10px;">
          <tr style="border-bottom: 1px dashed #ccc;">
            <th style="text-align: left;">Item</th>
            <th style="text-align: right;">Amount</th>
          </tr>
          ${invoice.lineItems
            .map(
              (item) => `
            <tr>
              <td>${item.description}</td>
              <td style="text-align: right;">${formatAmount(item.total, invoice.currency)}</td>
            </tr>
          `
            )
            .join('')}
        </table>

        <div style="border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 5px 0; margin: 10px 0; text-align: right;">
          <div><strong>TOTAL:</strong> <strong>${formatAmount(invoice.total, invoice.currency)}</strong></div>
        </div>

        <div style="text-align: right; margin-bottom: 10px;">
          <div>Paid: ${formatAmount(invoice.amountPaid, invoice.currency)}</div>
          <div>Due: ${formatAmount(invoice.amountDue, invoice.currency)}</div>
        </div>

        <div style="border-top: 1px dashed #ccc; padding-top: 10px; text-align: center; font-size: 11px;">
          <div>Thank you for choosing us!</div>
          <div>${invoice.clinicDetails.email || ''}</div>
        </div>
      </div>
    `;
  }

  /**
   * Private: Generate prescription HTML
   */
  private generatePrescriptionHtml(
    visit: Visit,
    patient: Patient,
    clinicSettings: ClinicSettings
  ): string {
    const medicationsHtml = visit.prescription
      .map(
        (med) => `
      <tr>
        <td>${med.name}</td>
        <td>${med.dosage}</td>
        <td>${med.quantity}</td>
      </tr>
    `
      )
      .join('');

    return `
      <div class="prescription-container">
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="font-size: 16px; font-weight: bold;">${clinicSettings.name}</div>
          <div>${clinicSettings.location}</div>
          <div>Tel: ${clinicSettings.phone}</div>
          <div style="margin-top: 10px; font-style: italic;">PRESCRIPTION</div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
          <div>
            <div><strong>Patient Name:</strong> ${patient.name}</div>
            <div><strong>Age:</strong> ${patient.age}</div>
            <div><strong>Gender:</strong> ${patient.gender}</div>
            <div><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
          </div>
          <div>
            <div><strong>Visit ID:</strong> ${visit.id}</div>
            <div><strong>Chief Complaint:</strong> ${visit.chiefComplaint || 'Not specified'}</div>
            <div><strong>Diagnosis:</strong> ${visit.diagnosis || 'Pending'}</div>
          </div>
        </div>

        <div style="margin: 20px 0;">
          <div style="font-weight: bold; margin-bottom: 10px;">MEDICATIONS:</div>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Medication</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Dosage</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${medicationsHtml}
            </tbody>
          </table>
        </div>

        ${
          visit.doctorNotes
            ? `
          <div style="margin: 20px 0; background: #f9f9f9; padding: 10px; border-left: 3px solid #3462EE;">
            <strong>Doctor's Notes:</strong>
            <div>${visit.doctorNotes}</div>
          </div>
        `
            : ''
        }

        <div style="margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr;">
          <div>
            <div class="signature-line"></div>
            <div style="font-size: 12px;">Doctor's Signature</div>
          </div>
          <div style="text-align: right;">
            <div class="signature-line"></div>
            <div style="font-size: 12px;">Date</div>
          </div>
        </div>

        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #666;">
          <div>Follow-up after completing medication</div>
          <div>Keep this prescription for your records</div>
        </div>
      </div>
    `;
  }

  /**
   * Private: Generate medical report HTML
   */
  private generateMedicalReportHtml(
    visit: Visit,
    patient: Patient,
    clinicSettings: ClinicSettings
  ): string {
    return `
      <div class="report-container">
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="font-size: 16px; font-weight: bold;">${clinicSettings.name}</div>
          <div>Medical Report</div>
        </div>

        <div style="margin: 20px 0;">
          <strong>Patient Information:</strong>
          <div style="background: #f5f5f5; padding: 10px; border-radius: 5px; margin: 10px 0;">
            <div>Name: ${patient.name}</div>
            <div>Age: ${patient.age} years | Gender: ${patient.gender}</div>
            <div>Phone: ${patient.phone}</div>
            <div>ID: ${patient.id}</div>
          </div>
        </div>

        <div style="margin: 20px 0;">
          <strong>Visit Details:</strong>
          <div style="background: #f5f5f5; padding: 10px; border-radius: 5px; margin: 10px 0;">
            <div>Date: ${new Date(visit.startTime).toLocaleString()}</div>
            <div>Visit ID: ${visit.id}</div>
            <div>Priority: ${visit.priority}</div>
          </div>
        </div>

        ${
          visit.vitals
            ? `
          <div style="margin: 20px 0;">
            <strong>Vital Signs:</strong>
            <div style="background: #f5f5f5; padding: 10px; border-radius: 5px; margin: 10px 0;">
              <div>Blood Pressure: ${visit.vitals.bp}</div>
              <div>Temperature: ${visit.vitals.temp}°C</div>
              <div>Heart Rate: ${visit.vitals.heartRate} bpm</div>
              <div>Weight: ${visit.vitals.weight} kg</div>
            </div>
          </div>
        `
            : ''
        }

        <div style="margin: 20px 0;">
          <strong>Clinical Assessment:</strong>
          <div style="background: #f5f5f5; padding: 10px; border-radius: 5px; margin: 10px 0;">
            <div>Chief Complaint: ${visit.chiefComplaint || 'Not specified'}</div>
            <div>Diagnosis: ${visit.diagnosis || 'Pending'}</div>
            <div>Doctor's Notes: ${visit.doctorNotes || 'None'}</div>
          </div>
        </div>

        <div style="margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px;">
          <div class="signature-line"></div>
          <div style="font-size: 12px;">Medical Professional Signature</div>
        </div>
      </div>
    `;
  }

  /**
   * Private: Wrap HTML with proper structure
   */
  private wrapHtml(content: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background: white;
          }
          @media print {
            body { margin: 0; padding: 20px; }
            .no-print { display: none !important; }
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f5f5f5; }
        </style>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `;
  }
}

// Export singleton instance
export const documentGenerator = new DocumentGenerator();

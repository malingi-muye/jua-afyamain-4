import React, { useState, useMemo } from 'react';
import { Invoice } from '../services/invoiceService';
import { FileText, Download, Printer, Eye, DollarSign, AlertTriangle, CheckCircle, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatAmount } from '../services/paymentService';
import { documentGenerator } from '../services/documentService';

interface InvoiceListProps {
  invoices: Invoice[];
  onPaymentClick?: (invoice: Invoice) => void;
  onPrintClick?: (invoice: Invoice) => void;
  onDownloadClick?: (invoice: Invoice) => void;
}

const InvoiceList: React.FC<InvoiceListProps> = ({
  invoices,
  onPaymentClick,
  onPrintClick,
  onDownloadClick,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'partial' | 'paid' | 'overdue'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  const itemsPerPage = 10;

  // Filter and search
  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesSearch =
        inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.patientName.toLowerCase().includes(searchTerm.toLowerCase());

      if (statusFilter === 'all') return matchesSearch;
      return matchesSearch && inv.paymentStatus === statusFilter;
    });
  }, [invoices, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedInvoices = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' };
      case 'partial':
        return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' };
      case 'unpaid':
        return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' };
      default:
        return { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-700 dark:text-slate-300' };
    }
  };

  const handlePrint = async (invoice: Invoice) => {
    const html = await documentGenerator.generateInvoicePdf(invoice);
    documentGenerator.printDocument(html, `Invoice-${invoice.invoiceNumber}`);
    onPrintClick?.(invoice);
  };

  const handleDownload = async (invoice: Invoice) => {
    const html = await documentGenerator.generateInvoicePdf(invoice);
    documentGenerator.downloadDocument(html, `Invoice-${invoice.invoiceNumber}`);
    onDownloadClick?.(invoice);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Invoices</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Manage and track invoices</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-blue-600">{filtered.length}</div>
          <div className="text-sm text-slate-600 dark:text-slate-400">Total Invoices</div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-2">
          {(['all', 'unpaid', 'partial', 'paid'] as const).map((status) => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status);
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors capitalize ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {paginatedInvoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white">Invoice</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white">Patient</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white">Amount</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white">Date</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900 dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedInvoices.map((invoice, idx) => (
                  <React.Fragment key={invoice.id}>
                    <tr className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-400" />
                          <button
                            onClick={() =>
                              setExpandedInvoiceId(
                                expandedInvoiceId === invoice.id ? null : invoice.id
                              )
                            }
                            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                          >
                            {invoice.invoiceNumber}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{invoice.patientName}</td>
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                        {formatAmount(invoice.total, invoice.currency)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            getStatusColor(invoice.paymentStatus).bg
                          } ${getStatusColor(invoice.paymentStatus).text} capitalize`}
                        >
                          {invoice.paymentStatus === 'paid' && <CheckCircle className="w-3 h-3 inline mr-1" />}
                          {invoice.paymentStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {new Date(invoice.issuedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {invoice.paymentStatus !== 'paid' && (
                            <button
                              onClick={() => onPaymentClick?.(invoice)}
                              className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                              title="Process Payment"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handlePrint(invoice)}
                            className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Print"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownload(invoice)}
                            className="p-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              setExpandedInvoiceId(
                                expandedInvoiceId === invoice.id ? null : invoice.id
                              )
                            }
                            className="p-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Details */}
                    {expandedInvoiceId === invoice.id && (
                      <tr className="bg-slate-50 dark:bg-slate-700/30 border-b border-slate-200 dark:border-slate-700">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Line Items</h4>
                              <div className="space-y-2">
                                {invoice.lineItems.map((item, idx) => (
                                  <div key={idx} className="flex justify-between text-sm">
                                    <span className="text-slate-700 dark:text-slate-300">{item.description}</span>
                                    <span className="text-slate-900 dark:text-white font-medium">
                                      {formatAmount(item.total, invoice.currency)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Summary</h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-slate-700 dark:text-slate-300">Subtotal:</span>
                                  <span className="text-slate-900 dark:text-white">
                                    {formatAmount(invoice.subtotal, invoice.currency)}
                                  </span>
                                </div>
                                {invoice.taxAmount > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-700 dark:text-slate-300">Tax ({invoice.taxRate}%):</span>
                                    <span className="text-slate-900 dark:text-white">
                                      {formatAmount(invoice.taxAmount, invoice.currency)}
                                    </span>
                                  </div>
                                )}
                                {invoice.discountAmount > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-700 dark:text-slate-300">Discount:</span>
                                    <span className="text-slate-900 dark:text-white">
                                      -{formatAmount(invoice.discountAmount, invoice.currency)}
                                    </span>
                                  </div>
                                )}
                                <div className="border-t border-slate-200 dark:border-slate-600 pt-2 flex justify-between font-semibold">
                                  <span className="text-slate-900 dark:text-white">Total:</span>
                                  <span className="text-blue-600 dark:text-blue-400">
                                    {formatAmount(invoice.total, invoice.currency)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-700 dark:text-slate-300">Paid:</span>
                                  <span className="text-green-600 dark:text-green-400">
                                    {formatAmount(invoice.amountPaid, invoice.currency)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-700 dark:text-slate-300">Due:</span>
                                  <span className={invoice.amountDue > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                                    {formatAmount(invoice.amountDue, invoice.currency)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">No invoices found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceList;

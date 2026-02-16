import React, { useState } from 'react';
import { CreditCard, Smartphone, DollarSign, Loader2, X, CheckCircle, AlertCircle } from 'lucide-react';
import { paymentService, formatAmount } from '../services/paymentService';
import { validation } from '../lib/validation';
import useStore from '../store';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  patientId: string;
  patientName: string;
  patientPhone: string;
  invoiceId: string;
  currency?: string;
  onPaymentSuccess?: (paymentRef: string) => void;
}

type PaymentMethod = 'card' | 'mpesa';

const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  amount,
  patientId,
  patientName,
  patientPhone,
  invoiceId,
  currency = 'KES',
  onPaymentSuccess,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');

  // M-Pesa specific state
  const [mpesaPhone, setMpesaPhone] = useState(patientPhone);
  const { settings } = useStore();

  // Initialize payment service with clinic settings when opening
  React.useEffect(() => {
    if (isOpen && settings.paymentConfig) {
      paymentService.initialize(settings.paymentConfig);
    }
  }, [isOpen, settings.paymentConfig]);

  const handleCardPayment = async () => {
    setError('');
    setIsProcessing(true);

    try {
      if (!paymentService.isConfigured('paystack')) {
        throw new Error('PayStack not configured. Please contact administrator.');
      }

      const { authorizationUrl } = await paymentService.initializePayStackPayment(
        amount,
        patientPhone,
        {
          invoiceId,
          patientId,
          patientName,
        }
      );

      // Redirect to PayStack
      window.location.href = authorizationUrl;
    } catch (err: any) {
      setError(err.message || 'Failed to initiate payment');
      setIsProcessing(false);
    }
  };

  const handleMpesaPayment = async () => {
    setError('');

    // Validate phone
    if (!validation.isValidPhone(mpesaPhone)) {
      setError('Invalid phone number');
      return;
    }

    setIsProcessing(true);

    try {
      if (!paymentService.isConfigured('mpesa')) {
        throw new Error('M-Pesa not configured. Please contact administrator.');
      }

      const { checkoutRequestId } = await paymentService.initializeMpesaPayment(
        mpesaPhone,
        amount,
        invoiceId,
        `Invoice ${invoiceId} - ${patientName}`
      );

      setPaymentReference(checkoutRequestId);
      setSuccess(true);

      // Auto-close after 3 seconds
      setTimeout(() => {
        onPaymentSuccess?.(checkoutRequestId);
        onClose();
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to initiate M-Pesa payment');
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Process Payment</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Success State */}
        {success ? (
          <div className="flex flex-col items-center text-center py-12">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Payment Initiated
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
              Please check your phone for the M-Pesa prompt
            </p>
            <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-lg">
              <span className="text-xs text-slate-600 dark:text-slate-400">Ref: {paymentReference}</span>
            </div>
          </div>
        ) : (
          <>
            {/* Amount Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-6 mb-6 border border-blue-200 dark:border-blue-800">
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">Amount to Pay</div>
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                {formatAmount(amount, currency)}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-3 space-y-1">
                <div><strong>Patient:</strong> {patientName}</div>
                <div><strong>Invoice:</strong> {invoiceId}</div>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="space-y-3 mb-6">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                Payment Method
              </label>

              {/* Card Option */}
              <label className="flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all"
                style={{
                  borderColor: paymentMethod === 'card' ? '#3462EE' : '#e2e8f0',
                  backgroundColor: paymentMethod === 'card' ? '#f0f4ff' : 'transparent',
                }}>
                <input
                  type="radio"
                  name="payment"
                  value="card"
                  checked={paymentMethod === 'card'}
                  onChange={() => setPaymentMethod('card')}
                  className="w-4 h-4"
                />
                <CreditCard className="w-5 h-5 text-slate-600 mx-3" />
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">Card Payment</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Visa, Mastercard via PayStack</div>
                </div>
              </label>

              {/* M-Pesa Option */}
              <label className="flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all"
                style={{
                  borderColor: paymentMethod === 'mpesa' ? '#3462EE' : '#e2e8f0',
                  backgroundColor: paymentMethod === 'mpesa' ? '#f0f4ff' : 'transparent',
                }}>
                <input
                  type="radio"
                  name="payment"
                  value="mpesa"
                  checked={paymentMethod === 'mpesa'}
                  onChange={() => setPaymentMethod('mpesa')}
                  className="w-4 h-4"
                />
                <Smartphone className="w-5 h-5 text-slate-600 mx-3" />
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">M-Pesa</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Mobile money payment</div>
                </div>
              </label>
            </div>

            {/* M-Pesa Phone Input */}
            {paymentMethod === 'mpesa' && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={mpesaPhone}
                  onChange={(e) => setMpesaPhone(e.target.value)}
                  placeholder="+254712345678"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-2">Enter M-Pesa registered number</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 mb-6">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={paymentMethod === 'card' ? handleCardPayment : handleMpesaPayment}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white font-semibold rounded-xl transition-colors"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {paymentMethod === 'card' ? <CreditCard className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                    Pay {formatAmount(amount, currency)}
                  </>
                )}
              </button>
            </div>

            {/* Info Box */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                💡 <strong>Tip:</strong> For card payments, you'll be redirected to PayStack's secure payment page. For M-Pesa, you'll receive a prompt on your phone.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;

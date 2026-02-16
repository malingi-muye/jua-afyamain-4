import React, { useState, useEffect, useRef, Suspense } from 'react';
import {
    Bell, Lock, Globe, CreditCard, ChevronRight, Moon, Sun, Save,
    Upload, Shield, Smartphone, Mail, AlertTriangle, CheckCircle,
    Layout, Receipt, Laptop, Smartphone as SmartphoneIcon, LogOut, Loader2,
    Users, UserPlus, Database, Activity, Trash2, X, Plus, Download, RefreshCw,
    Zap, Check, ArrowRight, Link
} from 'lucide-react';
import { ClinicSettings, Role, TeamMember } from '../types';
import { paymentService } from '../services/paymentService';
import { useEnterpriseAuth } from "../hooks/useEnterpriseAuth";
import { useNavigate } from "react-router-dom";
import { enterpriseDb } from '../services/enterprise-db';
import { canCurrentUser } from '../lib/roleMapper'
import useStore from '../store'
import logger from '../lib/logger'
import { db } from '../services/db'
import { teamService } from '../services/teamService';

interface SettingsProps {
    isDarkMode: boolean;
    toggleTheme: () => void;
    settings: ClinicSettings;
    updateSettings: (s: ClinicSettings) => void;
    showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type Tab = 'general' | 'notifications' | 'integrations' | 'security' | 'billing' | 'team' | 'logs';

// Mock Plans Data
const PLANS = [
    { id: 'Free', price: 0, features: ['Up to 100 Patients', 'Basic Appointments', '1 User Account', 'Community Support'] },
    { id: 'Pro', price: 5000, features: ['Unlimited Patients', 'SMS Reminders', 'Up to 5 Users', 'Inventory Management', 'Priority Support'], recommended: true },
    { id: 'Enterprise', price: 15000, features: ['Unlimited Everything', 'Dedicated Account Manager', 'Custom API Integrations', 'Multi-branch Support', 'Audit Logs'] }
];

const Settings: React.FC<SettingsProps> = ({ isDarkMode, toggleTheme, settings, updateSettings, showToast }) => {
    const [activeTab, setActiveTab] = useState<Tab>('general');
    const [formData, setFormData] = useState<ClinicSettings>(settings);
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    // Modals
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    // -- Billing & Subscription State --
    const [showPricingModal, setShowPricingModal] = useState(false);
    const [showSMSModal, setShowSMSModal] = useState(false);
    const [showCheckout, setShowCheckout] = useState(false);

    // Checkout Context
    const [checkoutItem, setCheckoutItem] = useState<{ type: 'Plan' | 'Credits', name: string, amount: number, detail?: string } | null>(null);
    const [paymentStep, setPaymentStep] = useState<'review' | 'processing' | 'success'>('review');
    const [processingStatus, setProcessingStatus] = useState('');

    // SMS Purchase State
    const [smsCreditsToBuy, setSmsCreditsToBuy] = useState(1000);

    // Invite Form
    const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'Doctor' as Role });

    // Security Form State
    const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });

    // File Input Ref
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Delete Clinic Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState('');
    const [deleteReason, setDeleteReason] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState(''); // Added error state
    const { organization, signOut } = useEnterpriseAuth();
    const { currentUser, actions } = useStore();
    const navigate = useNavigate();

    const handleDeleteClinic = async () => {
        setIsDeleting(true);
        setError('');
        try {
            if (organization?.id) {
                await enterpriseDb.deleteClinic(organization.id, deleteReason);
            }
            // Sign out
            await signOut();
            navigate('/login');
        } catch (err: any) {
            setError(err.message || 'Failed to delete clinic');
            setIsDeleting(false);
        }
    };

    useEffect(() => {
        setFormData(settings);
    }, [settings]);

    // Update payment config status automatically
    useEffect(() => {
        const pc = formData.paymentConfig;
        const isConfigured = pc?.provider !== 'None' && !!pc?.apiKey && !!pc?.secretKey;

        if (pc && pc.isConfigured !== isConfigured) {
            setFormData(prev => ({
                ...prev,
                paymentConfig: {
                    ...prev.paymentConfig,
                    isConfigured
                }
            }));
        }
    }, [formData.paymentConfig?.provider, formData.paymentConfig?.apiKey, formData.paymentConfig?.secretKey]);

    // -- Generic Handlers --

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setHasChanges(true);
    };

    const handleNestedChange = (section: keyof ClinicSettings, field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            [section]: {
                ...(prev[section] as object),
                [field]: value
            }
        }));
        setHasChanges(true);
    };

    const handleSave = () => {
        setIsSaving(true);
        // Simulate API delay
        setTimeout(() => {
            updateSettings(formData);

            // Initialize payment service with new config if it was updated
            if (formData.paymentConfig.provider !== 'None' && formData.paymentConfig.apiKey) {
                paymentService.initialize(formData.paymentConfig);
            }

            setHasChanges(false);
            setIsSaving(false);
            setPasswordForm({ current: '', new: '', confirm: '' });
        }, 800);
    };

    const handleCancel = () => {
        setFormData(settings);
        setHasChanges(false);
        setPasswordForm({ current: '', new: '', confirm: '' });
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, logo: reader.result as string });
                setHasChanges(true);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSyncOfflineData = async () => {
        setIsSyncing(true);
        setError('');
        try {
            // Get offline data from localStorage/Zustand
            const offlineData = {
                patients: JSON.parse(localStorage.getItem('offline_patients') || '[]'),
                appointments: JSON.parse(localStorage.getItem('offline_appointments') || '[]'),
                inventory: JSON.parse(localStorage.getItem('offline_inventory') || '[]'),
                visits: JSON.parse(localStorage.getItem('offline_visits') || '[]'),
            };

            // Use enterprise-db to sync each type
            // const { enterpriseDb } = await import('../services/enterprise-db');

            let syncedCount = 0;
            let errorCount = 0;

            // Sync patients
            for (const patient of offlineData.patients) {
                try {
                    await enterpriseDb.createPatient(patient);
                    syncedCount++;
                } catch (e) {
                    logger.warn('Failed to sync patient:', e);
                    errorCount++;
                }
            }

            // Sync appointments
            for (const appt of offlineData.appointments) {
                try {
                    await enterpriseDb.createAppointment(appt);
                    syncedCount++;
                } catch (e) {
                    logger.warn('Failed to sync appointment:', e);
                    errorCount++;
                }
            }

            // Sync inventory
            for (const item of offlineData.inventory) {
                try {
                    await enterpriseDb.createInventoryItem(item);
                    syncedCount++;
                } catch (e) {
                    logger.warn('Failed to sync inventory:', e);
                    errorCount++;
                }
            }

            // Clear offline data after successful sync
            if (errorCount === 0) {
                localStorage.removeItem('offline_patients');
                localStorage.removeItem('offline_appointments');
                localStorage.removeItem('offline_inventory');
                localStorage.removeItem('offline_visits');
            }

            if (syncedCount > 0) {
                if (showToast) showToast(`Synced ${syncedCount} items${errorCount > 0 ? ` (${errorCount} errors)` : ''}`, errorCount > 0 ? 'error' : 'success');
            } else {
                if (showToast) showToast('No offline data to sync', 'info');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to sync offline data');
            if (showToast) showToast('Sync failed', 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleExportData = () => {
        setIsExporting(true);
        setTimeout(() => {
            const data = {
                settings: formData,
                timestamp: new Date().toISOString(),
                version: '1.0',
                localData: localStorage
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `juaafya_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setIsExporting(false);
        }, 1000);
    };

    const handleDownloadInvoice = (date: string, amount: string) => {
        const content = `
      INVOICE #INV-${Math.floor(Math.random() * 10000)}
      Date: ${date}
      Status: PAID
      
      Bill To: ${formData.name}
      Amount: ${amount}
      
      --------------------------------
      Description          Amount
      --------------------------------
      JuaAfya Subscription ${amount}
      --------------------------------
      Total                ${amount}
      `;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Invoice_${date.replace(/ /g, '_')}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // -- Billing Handlers --

    const initiatePlanUpgrade = (planId: string, price: number) => {
        setCheckoutItem({
            type: 'Plan',
            name: `${planId} Plan Subscription`,
            amount: price,
            detail: 'Monthly recurring billing'
        });
        setShowPricingModal(false);
        setPaymentStep('review');
        setShowCheckout(true);
    };

    const initiateSmsPurchase = () => {
        const cost = Math.round(smsCreditsToBuy * 1.5); // 1.5 KSh per SMS
        setCheckoutItem({
            type: 'Credits',
            name: `${smsCreditsToBuy.toLocaleString()} SMS Credits`,
            amount: cost,
            detail: 'One-time purchase'
        });
        setShowSMSModal(false);
        setPaymentStep('review');
        setShowCheckout(true);
    };

    const processPayment = async () => {
        setPaymentStep('processing');
        setProcessingStatus('Initializing payment...');

        try {
            // 1. Fetch Platform Settings for SaaS Billing
            // We use the platform's Paystack keys, NOT the clinic's keys
            const platformSettings = await db.getPlatformSettings();
            const platformPaystackConfig = platformSettings.gateways?.paystack;

            if (!platformPaystackConfig?.publicKey) {
                throw new Error('Platform billing is not configured (Missing Public Key). Please contact support.');
            }

            // Initialize service with PLATFORM credentials
            // We do NOT pass the secret key here. The Edge Function uses its Env Var.
            paymentService.initialize({
                provider: 'PayStack',
                apiKey: platformPaystackConfig.publicKey,
                secretKey: '', // Intentionally empty/undefined
                testMode: false
            });

            if (!checkoutItem) return;

            // Log payment attempt
            const paymentId = `payment-${Date.now()}`;
            await enterpriseDb.logAudit(
                'payment_initiated',
                checkoutItem.type === 'Plan' ? 'subscription' : 'sms_credits',
                paymentId,
                {},
                { type: checkoutItem.type, amount: checkoutItem.amount, item: checkoutItem.name }
            );

            let result;

            // Determine provider based on user selection (in a real app, we'd have a selector in the modal)
            // For now, default to PayStack (Card) unless they specifically requested M-Pesa behavior
            // Since we are using Paystack for everything platform-side:

            // Default to Standard PayStack Checkout (Card/Mobile Money)
            // for all platform payments to avoid needing separate M-Pesa credentials
            setProcessingStatus('Preparing secure checkout...');

            result = await paymentService.initializePayStackPayment(
                checkoutItem.amount,
                formData.email,
                {
                    plan: checkoutItem.name,
                    type: checkoutItem.type,
                    clinicId: organization?.id || 'unknown_clinic'
                }
            );

            if (result.authorizationUrl) {
                // In a real app, we might redirect or open a popup
                // window.open(result.authorizationUrl, '_blank');
                setProcessingStatus('Redirecting to PayStack...');
                await new Promise(r => setTimeout(r, 2000));
            }


            // 2. On Success (Simulated completion for flow)
            if (checkoutItem.type === 'Plan') {
                const planName = checkoutItem.name.split(' ')[0];
                const nextDate = new Date();
                nextDate.setMonth(nextDate.getMonth() + 1);

                const newSettings = {
                    ...formData,
                    billing: {
                        ...formData.billing,
                        plan: planName as any,
                        nextBillingDate: nextDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    }
                };
                setFormData(newSettings);
                updateSettings(newSettings);
            } else if (checkoutItem.type === 'Credits' && checkoutItem.name.includes('SMS')) {
                // Add credits logic (would depend on backend confirmation)
                const newCredits = (formData.smsConfig?.credits || 0) + smsCreditsToBuy;
                const newSettings = {
                    ...formData,
                    smsConfig: {
                        ...formData.smsConfig,
                        credits: newCredits
                    }
                };
                setFormData(newSettings);
                updateSettings(newSettings);
            }

            setPaymentStep('success');

        } catch (error: any) {
            console.error("Payment Failed", error);
            setProcessingStatus(`Failed: ${error.message}`);
            setTimeout(() => setPaymentStep('review'), 3000);
        }
    };

    // -- Team Logic --
    const handleInviteMember = async () => {
        if (!inviteForm.name || !inviteForm.email) return;

        setIsSaving(true);
        try {
            await teamService.inviteTeamMember(inviteForm.email, inviteForm.role, currentUser?.name || 'Admin');

            actions.showToast(`Invitation sent to ${inviteForm.email}`, 'success');

            // Refresh team list in state
            const updatedTeam = await teamService.getTeamMembers();
            setFormData(prev => ({
                ...prev,
                team: updatedTeam
            }));

            setShowInviteModal(false);
            setInviteForm({ name: '', email: '', role: 'Doctor' });
        } catch (error: any) {
            console.error('Failed to invite member:', error);
            const errorMsg = error.message || 'Failed to send invitation. Please try again.';
            actions.showToast(errorMsg, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveMember = (id: string) => {
        setFormData(prev => ({
            ...prev,
            team: prev.team.filter(m => m.id !== id)
        }));
        setHasChanges(true);
    };

    // -- Render Sections --

    const renderGeneral = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Profile Card */}
            <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Clinic Identity</h3>

                <div className="flex flex-col sm:flex-row items-center gap-6 mb-8">
                    <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border-4 border-slate-50 dark:border-slate-600 shadow-inner">
                            {formData.logo ? (
                                <img src={formData.logo} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-slate-400 dark:text-slate-300 text-2xl font-bold uppercase">{formData.name.substring(0, 2)}</span>
                            )}
                        </div>
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Upload className="w-6 h-6 text-white" />
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </div>
                    <div className="text-center sm:text-left">
                        <h4 className="font-bold text-slate-900 dark:text-white">Clinic Logo</h4>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">Upload your clinic's official logo. Recommended size 400x400px. JPG or PNG.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Clinic Name</label>
                        <input name="name" value={formData.name} onChange={handleChange} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Primary Phone</label>
                        <input name="phone" value={formData.phone} onChange={handleChange} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Admin Email</label>
                        <input name="email" value={formData.email} onChange={handleChange} type="email" className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Physical Address</label>
                        <input name="location" value={formData.location} onChange={handleChange} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white" />
                    </div>
                </div>
            </div>

            {/* Regional */}
            <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Regional Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Currency</label>
                        <select name="currency" value={formData.currency} onChange={handleChange} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white">
                            <option value="KSh">Kenyan Shilling (KSh)</option>
                            <option value="USD">US Dollar ($)</option>
                            <option value="EUR">Euro (€)</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Timezone</label>
                        <select name="timezone" value={formData.timezone} onChange={handleChange} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white">
                            <option value="EAT (GMT+3)">Nairobi (GMT+3)</option>
                            <option value="UTC">UTC</option>
                            <option value="PST">Pacific Time</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Language</label>
                        <select name="language" value={formData.language} onChange={handleChange} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white">
                            <option value="English">English</option>
                            <option value="Swahili">Swahili</option>
                            <option value="French">French</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Data Management */}
            <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <Database className="w-5 h-5 text-slate-500" /> Data Management
                </h3>
                <div className="flex flex-col sm:flex-row gap-4">
                    <button
                        onClick={handleExportData}
                        disabled={isExporting}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex-1 disabled:opacity-50"
                    >
                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Export All Data
                    </button>
                    <button
                        onClick={handleSyncOfflineData}
                        disabled={isSyncing}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex-1 disabled:opacity-50"
                    >
                        {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        {isSyncing ? 'Syncing...' : 'Sync Offline Data'}
                    </button>
                </div>

                <div className="mt-8 pt-8 border-t border-red-100 dark:border-red-900/30">
                    <h4 className="text-red-600 font-bold mb-2">Danger Zone</h4>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl">
                        <div>
                            <p className="text-sm font-bold text-red-700 dark:text-red-400">Delete Clinic Account</p>
                            <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">This will cancel your clinic account. All data will be marked as cancelled and can be restored within 30 days.</p>
                        </div>
                        <button
                            onClick={() => {
                                if (!canCurrentUser('settings.delete_clinic')) {
                                    try { useStore.getState().actions.showToast('You are not authorized to delete the clinic.', 'error') } catch (e) { alert('You are not authorized to delete the clinic.') }
                                    return
                                }
                                setShowDeleteModal(true)
                            }}
                            className="px-4 py-2 bg-white dark:bg-red-900/50 text-red-600 dark:text-red-300 font-bold text-xs border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900 transition-colors whitespace-nowrap"
                        >
                            Delete Account
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderNotifications = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Notification Channels</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Control how and when you receive alerts.</p>

                <div className="space-y-1">
                    <div className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded-xl transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400"><Smartphone className="w-5 h-5" /></div>
                            <div>
                                <div className="font-semibold text-slate-900 dark:text-white text-sm">SMS Alerts</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">Receive critical alerts via text message</div>
                            </div>
                        </div>
                        <div
                            onClick={() => { setFormData({ ...formData, smsEnabled: !formData.smsEnabled }); setHasChanges(true); }}
                            className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors duration-200 ${formData.smsEnabled ? 'bg-teal-600' : 'bg-slate-300'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${formData.smsEnabled ? 'left-7' : 'left-1'}`}></div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded-xl transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400"><Mail className="w-5 h-5" /></div>
                            <div>
                                <div className="font-semibold text-slate-900 dark:text-white text-sm">Email Reports</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">Daily summaries sent to your inbox</div>
                            </div>
                        </div>
                        <div
                            onClick={() => handleNestedChange('notifications', 'dailyReports', !formData.notifications.dailyReports)}
                            className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors duration-200 ${formData.notifications.dailyReports ? 'bg-teal-600' : 'bg-slate-300'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${formData.notifications.dailyReports ? 'left-7' : 'left-1'}`}></div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">Alert Email Address</label>
                    <div className="flex gap-2">
                        <input
                            value={formData.notifications.alertEmail}
                            onChange={(e) => handleNestedChange('notifications', 'alertEmail', e.target.value)}
                            className="flex-1 p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white"
                            placeholder="alerts@juaafya.com"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Event Triggers</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { id: 'appointmentReminders', label: 'Patient Appointment Reminders', desc: 'Auto-send 24h before', icon: Layout },
                        { id: 'lowStockAlerts', label: 'Low Stock Warnings', desc: 'Notify when stock ≤ Minimum Level', icon: AlertTriangle },
                        { id: 'marketingEmails', label: 'Marketing Campaigns', desc: 'Seasonal promotions', icon: Globe },
                    ].map((item) => (
                        <div key={item.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl flex items-start gap-3">
                            <input
                                type="checkbox"
                                checked={(formData.notifications as any)[item.id]}
                                onChange={(e) => handleNestedChange('notifications', item.id, e.target.checked)}
                                className="mt-1 w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                            />
                            <div>
                                <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{item.label}</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderIntegrations = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* SMS Gateway Configuration */}
            <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                    <SmartphoneIcon className="w-5 h-5 text-indigo-600" /> SMS Gateway Configuration
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    Configure your SMS provider settings (Mobiwave) to enable automated messaging.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Service Status</label>
                        <div className="relative">
                            <CheckCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                            <input
                                type="text"
                                disabled
                                value="Active (Platform Managed)"
                                className="w-full pl-10 pr-3 py-3 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed"
                            />
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Infrastructure provided by JuaAfya Platform.</p>
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Sender ID</label>
                        <input
                            name="senderId"
                            value={formData.smsConfig?.senderId || ''}
                            onChange={(e) => handleNestedChange('smsConfig', 'senderId', e.target.value)}
                            className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white"
                            placeholder="e.g. MOBIWAVE or CLINIC"
                        />
                        <p className="text-xs text-slate-400 mt-1">Must be registered and approved.</p>
                    </div>
                </div>
            </div>

            {/* Payment Configuration */}
            <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-emerald-600" /> Payment Configuration
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    Configure your payment provider to accept online payments from patients.
                </p>

                <div className="space-y-6">
                    {/* Provider Selection */}
                    <div>
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 block">Payment Provider</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {['PayStack', 'M-Pesa', 'None'].map((provider) => (
                                <button
                                    key={provider}
                                    onClick={() => handleNestedChange('paymentConfig', 'provider', provider as any)}
                                    className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center ${formData.paymentConfig?.provider === provider
                                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500'
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                                        }`}
                                >
                                    {provider === 'PayStack' && <CreditCard className="w-4 h-4 mr-2" />}
                                    {provider === 'M-Pesa' && <SmartphoneIcon className="w-4 h-4 mr-2" />}
                                    {provider}
                                </button>
                            ))}
                        </div>
                        {formData.paymentConfig?.provider === 'M-Pesa' && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 italic px-1">
                                Note: M-Pesa is processed via PayStack gateway. Use your PayStack API keys below.
                            </p>
                        )}
                    </div>

                    {/* Provider-specific Configuration */}
                    {formData.paymentConfig?.provider !== 'None' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                            <div>
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Public Key</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="password"
                                        value={formData.paymentConfig?.apiKey || ''}
                                        onChange={(e) => handleNestedChange('paymentConfig', 'apiKey', e.target.value)}
                                        className="w-full pl-10 pr-3 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white"
                                        placeholder="pk_live_... or pk_test_..."
                                    />
                                </div>
                                <p className="text-xs text-slate-400 mt-1">From PayStack Dashboard</p>
                            </div>

                            <div>
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Secret Key</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="password"
                                        value={formData.paymentConfig?.secretKey || ''}
                                        onChange={(e) => handleNestedChange('paymentConfig', 'secretKey', e.target.value)}
                                        className="w-full pl-10 pr-3 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white"
                                        placeholder="sk_live_... or sk_test_..."
                                    />
                                </div>
                                <p className="text-xs text-slate-400 mt-1">Keep this secure and never share publicly</p>
                            </div>

                            <div>
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Webhook URL</label>
                                <input
                                    type="text"
                                    value={formData.paymentConfig?.webhookUrl || ''}
                                    onChange={(e) => handleNestedChange('paymentConfig', 'webhookUrl', e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white font-mono"
                                    placeholder="https://yourdomain.com/webhooks/payment"
                                />
                                <p className="text-xs text-slate-400 mt-1">URL where PayStack sends payment events</p>
                            </div>

                            <div>
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Webhook Secret</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="password"
                                        value={formData.paymentConfig?.webhookSecret || ''}
                                        onChange={(e) => handleNestedChange('paymentConfig', 'webhookSecret', e.target.value)}
                                        className="w-full pl-10 pr-3 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white"
                                        placeholder="whsec_..."
                                    />
                                </div>
                                <p className="text-xs text-slate-400 mt-1">Verify webhook authenticity</p>
                            </div>
                        </div>
                    )}

                    {/* Test Mode Toggle & Status */}
                    {formData.paymentConfig?.provider !== 'None' && (
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-700 space-y-4">
                            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl">
                                <div>
                                    <h4 className="font-semibold text-slate-900 dark:text-white text-sm">Test Mode</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Process test transactions without charging customers</p>
                                </div>
                                <div
                                    onClick={() => handleNestedChange('paymentConfig', 'testMode', !formData.paymentConfig?.testMode)}
                                    className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors duration-200 ${formData.paymentConfig?.testMode ? 'bg-amber-500' : 'bg-slate-300'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${formData.paymentConfig?.testMode ? 'left-7' : 'left-1'}`}></div>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl flex items-start gap-3">
                                <div className={`mt-0.5 w-2 h-2 rounded-full ${formData.paymentConfig?.isConfigured ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                                <div>
                                    <h4 className="font-semibold text-slate-900 dark:text-white text-sm">Configuration Status</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        {formData.paymentConfig?.isConfigured
                                            ? `✓ ${formData.paymentConfig?.provider} is ready to accept payments`
                                            : 'Incomplete - All fields required to activate payments'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {formData.paymentConfig?.provider === 'None' && (
                        <div className="p-6 bg-slate-50 dark:bg-slate-700/30 rounded-xl text-center">
                            <CreditCard className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-500 dark:text-slate-400 text-sm">Activate PayStack to enable online payments</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderSecurity = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Password Change */}
            <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-teal-600" /> Password & Authentication
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h4 className="font-semibold text-slate-700 dark:text-slate-300 text-sm">Change Password</h4>
                        <div className="space-y-3">
                            <input
                                type="password" placeholder="Current Password"
                                value={passwordForm.current} onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                                className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                            />
                            <input
                                type="password" placeholder="New Password"
                                value={passwordForm.new} onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                                className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                            />
                            <input
                                type="password" placeholder="Confirm New Password"
                                value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                                className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                            />
                        </div>
                        <button
                            disabled={!passwordForm.current || !passwordForm.new}
                            onClick={() => { setHasChanges(true); handleSave(); }}
                            className="text-sm font-bold text-white bg-slate-900 dark:bg-slate-600 px-4 py-2 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Update Password
                        </button>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-semibold text-slate-700 dark:text-slate-300 text-sm">Two-Factor Authentication</h4>
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                            <div className="flex items-start gap-3">
                                <Shield className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mt-1" />
                                <div>
                                    <h5 className="font-bold text-indigo-900 dark:text-indigo-200 text-sm">Add an extra layer of security</h5>
                                    <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1 leading-relaxed">
                                        Require a code from your mobile device when logging in from a new location.
                                    </p>
                                </div>
                            </div>
                            <div className="mt-4 flex items-center justify-between">
                                <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase">
                                    {formData.security.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                                </span>
                                <div
                                    onClick={() => handleNestedChange('security', 'twoFactorEnabled', !formData.security.twoFactorEnabled)}
                                    className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors duration-200 ${formData.security.twoFactorEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${formData.security.twoFactorEnabled ? 'left-7' : 'left-1'}`}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Active Sessions */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Active Sessions</h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 border-b border-slate-50 dark:border-slate-700 last:border-0">
                        <div className="flex items-center gap-4">
                            <Laptop className="w-5 h-5 text-teal-600" />
                            <div>
                                <div className="text-sm font-semibold text-slate-900 dark:text-white">Current Session <span className="text-green-500 text-xs ml-2">(Active)</span></div>
                                <div className="text-xs text-slate-500">{new Date().toLocaleString()} • Web Browser</div>
                            </div>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">Authorized</span>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderTeam = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Team Members</h3>
                <button onClick={() => setShowInviteModal(true)} className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-xl font-bold text-sm shadow-lg hover:opacity-90 transition-opacity">
                    <UserPlus className="w-4 h-4" /> Invite User
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs uppercase text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-700">
                        <tr>
                            <th className="px-6 py-4">User</th>
                            <th className="px-6 py-4">Role</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Last Active</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700 text-sm">
                        {formData.team.map((member) => (
                            <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <img src={member.avatar || `https://ui-avatars.com/api/?name=${member.name}`} alt={member.name} className="w-10 h-10 rounded-full bg-slate-200" />
                                        <div>
                                            <div className="font-bold text-slate-900 dark:text-white">{member.name}</div>
                                            <div className="text-xs text-slate-500">{member.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${member.role?.toLowerCase() === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                                        'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                        }`}>
                                        {member.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center w-fit gap-1 ${member.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                        }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${member.status === 'Active' ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                                        {member.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                    {member.lastActive}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={() => handleRemoveMember(member.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Invite Team Member</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">Full Name</label>
                                <input
                                    value={inviteForm.name} onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })}
                                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                                    placeholder="e.g. John Doe"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">Email Address</label>
                                <input
                                    value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                                    placeholder="john@juaafya.com"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">Role</label>
                                <select
                                    value={inviteForm.role} onChange={e => setInviteForm({ ...inviteForm, role: e.target.value as Role })}
                                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                                >
                                    <option value="Admin">Admin</option>
                                    <option value="Doctor">Doctor</option>
                                    <option value="Nurse">Nurse</option>
                                    <option value="Receptionist">Receptionist</option>
                                    <option value="Lab Tech">Lab Tech</option>
                                    <option value="Pharmacist">Pharmacist</option>
                                    <option value="Accountant">Accountant</option>
                                </select>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setShowInviteModal(false)} className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
                                <button onClick={handleInviteMember} className="flex-1 py-3 font-bold text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors">Send Invite</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderLogs = () => {
        // Use real AuditLogViewer component
        const AuditLogViewer = React.lazy(() => import('./organization/auditlogviewer'));

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <Suspense fallback={<div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>}>
                    <AuditLogViewer limit={200} />
                </Suspense>
            </div>
        );
    };

    const renderBilling = () => {
        const currentPlanDetails = PLANS.find(p => p.id === formData.billing.plan) || PLANS[0];

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Current Plan */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-8 rounded-3xl shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-16 translate-x-16 pointer-events-none"></div>

                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <span className="bg-teal-500/20 text-teal-300 border border-teal-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                {formData.billing.plan} Plan
                            </span>
                            <h3 className="text-3xl font-bold mt-4">JuaAfya {formData.billing.plan}</h3>
                            <p className="text-slate-400 text-sm mt-2">Next billing date: {formData.billing.nextBillingDate}</p>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-bold">KSh {currentPlanDetails.price.toLocaleString()}</div>
                            <div className="text-slate-400 text-sm">/ month</div>
                        </div>
                    </div>

                    <div className="mt-8 space-y-2 relative z-10">
                        <div className="flex justify-between text-xs font-medium text-slate-300">
                            <span>SMS Credits Available</span>
                            <span>{formData.smsConfig?.credits || 0} / 1000</span>
                        </div>
                        <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                            <div
                                className="bg-teal-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, ((formData.smsConfig?.credits || 0) / 1000) * 100)}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-white/10 relative z-10 flex gap-3">
                        <button onClick={() => setShowPricingModal(true)} className="px-4 py-2 bg-white text-slate-900 font-bold rounded-lg text-sm hover:bg-slate-100 transition-colors">Change Plan</button>
                        <button onClick={() => setShowSMSModal(true)} className="px-4 py-2 bg-transparent border border-white/20 text-white font-bold rounded-lg text-sm hover:bg-white/10 transition-colors">Buy SMS Credits</button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Payment Method */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-900 dark:text-white">Payment Method</h3>
                            <button onClick={() => setShowPaymentModal(true)} className="text-xs text-teal-600 dark:text-teal-400 font-bold hover:underline">Edit</button>
                        </div>
                        <div className="flex items-center gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-700/30">
                            <div className={`w-12 h-8 rounded flex items-center justify-center shadow-sm ${formData.billing.paymentMethod.type === 'M-Pesa' ? 'bg-green-600 text-white' : 'bg-white dark:bg-slate-600'}`}>
                                {formData.billing.paymentMethod.type === 'M-Pesa' ? <Smartphone className="w-6 h-6" /> : <CreditCard className="w-6 h-6 text-slate-700 dark:text-slate-300" />}
                            </div>
                            <div>
                                <div className="font-bold text-slate-900 dark:text-white text-sm">
                                    {formData.billing.paymentMethod.type === 'M-Pesa' ? 'M-Pesa' : formData.billing.paymentMethod.brand} •••• {formData.billing.paymentMethod.last4}
                                </div>
                                <div className="text-xs text-slate-500">
                                    {formData.billing.paymentMethod.type === 'M-Pesa' ? 'Auto-pay active' : `Expires ${formData.billing.paymentMethod.expiry}`}
                                </div>
                            </div>
                            <CheckCircle className="w-5 h-5 text-teal-500 ml-auto" />
                        </div>
                    </div>

                    {/* Invoices */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-900 dark:text-white">Recent Invoices</h3>
                            <button className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">View All</button>
                        </div>
                        <div className="space-y-3">
                            <div className="flex flex-col items-center justify-center py-6 text-slate-400">
                                <Receipt className="w-8 h-8 opacity-20 mb-2" />
                                <span className="text-xs">No recent invoices found</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Payment Method Modal */}
                {showPaymentModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Update Payment Method</h3>
                            <div className="space-y-4">
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => handleNestedChange('billing', 'paymentMethod', { type: 'M-Pesa', last4: '0000', brand: 'M-Pesa' })}
                                        className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${formData.billing.paymentMethod.type === 'M-Pesa' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-slate-200 dark:border-slate-700'}`}
                                    >
                                        <Smartphone className="w-6 h-6 text-green-600" />
                                        <span className="font-bold text-sm text-slate-700 dark:text-slate-300">M-Pesa</span>
                                    </button>
                                    <button
                                        onClick={() => handleNestedChange('billing', 'paymentMethod', { type: 'Card', last4: '4242', brand: 'Visa', expiry: '12/25' })}
                                        className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${formData.billing.paymentMethod.type === 'Card' ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' : 'border-slate-200 dark:border-slate-700'}`}
                                    >
                                        <CreditCard className="w-6 h-6 text-teal-600" />
                                        <span className="font-bold text-sm text-slate-700 dark:text-slate-300">Card</span>
                                    </button>
                                </div>

                                {formData.billing.paymentMethod.type === 'M-Pesa' ? (
                                    <div>
                                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">Phone Number</label>
                                        <input className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none" placeholder="2547..." />
                                    </div>
                                ) : (
                                    <div>
                                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">Card Number</label>
                                        <input className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none" placeholder="0000 0000 0000 0000" />
                                    </div>
                                )}

                                <div className="flex gap-3 mt-6">
                                    <button onClick={() => setShowPaymentModal(false)} className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
                                    <button onClick={() => { setShowPaymentModal(false); setHasChanges(true); }} className="flex-1 py-3 font-bold text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors">Save</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // --- NEW: Pricing Modal ---
    const renderPricingModal = () => (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-5xl rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Choose Your Plan</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">Scale your clinic with features that fit your needs.</p>
                    </div>
                    <button onClick={() => setShowPricingModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {PLANS.map(plan => {
                        const isCurrent = formData.billing.plan === plan.id;
                        return (
                            <div key={plan.id} className={`relative p-6 rounded-2xl border-2 transition-all hover:scale-105 duration-300 ${isCurrent ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-900/10' : plan.recommended ? 'border-indigo-500 shadow-xl' : 'border-slate-200 dark:border-slate-700'}`}>
                                {plan.recommended && !isCurrent && <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-bold uppercase">Recommended</div>}
                                {isCurrent && <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-teal-600 text-white px-3 py-1 rounded-full text-xs font-bold uppercase">Current Plan</div>}

                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{plan.id}</h3>
                                <div className="mt-2 mb-6">
                                    <span className="text-3xl font-bold text-slate-900 dark:text-white">KSh {plan.price.toLocaleString()}</span>
                                    <span className="text-slate-500 dark:text-slate-400 text-sm"> / month</span>
                                </div>
                                <ul className="space-y-3 mb-8">
                                    {plan.features.map((feat, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                            <Check className="w-4 h-4 text-green-500" /> {feat}
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    onClick={() => initiatePlanUpgrade(plan.id, plan.price)}
                                    disabled={isCurrent}
                                    className={`w-full py-3 rounded-xl font-bold transition-colors ${isCurrent
                                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                                        : plan.recommended
                                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                            : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90'
                                        }`}
                                >
                                    {isCurrent ? 'Active Plan' : plan.price > 0 ? 'Upgrade Now' : 'Downgrade'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    // --- NEW: SMS Bundle Modal ---
    const renderSMSModal = () => (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl p-8 animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Smartphone className="w-6 h-6 text-green-600" /> Buy SMS Credits
                    </h2>
                    <button onClick={() => setShowSMSModal(false)}><X className="w-6 h-6 text-slate-400" /></button>
                </div>

                <div className="bg-slate-50 dark:bg-slate-700/30 p-6 rounded-2xl mb-6">
                    <p className="text-center text-slate-500 dark:text-slate-400 text-sm mb-4">Drag to choose bundle size</p>
                    <input
                        type="range" min="500" max="10000" step="500"
                        value={smsCreditsToBuy}
                        onChange={(e) => setSmsCreditsToBuy(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-green-600"
                    />
                    <div className="flex justify-between mt-2 text-xs font-bold text-slate-400 uppercase">
                        <span>500 SMS</span>
                        <span>10,000 SMS</span>
                    </div>
                </div>

                <div className="flex justify-between items-center mb-8 p-4 border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/10 rounded-xl">
                    <div>
                        <div className="text-3xl font-bold text-slate-900 dark:text-white">{smsCreditsToBuy.toLocaleString()}</div>
                        <div className="text-xs text-green-600 font-bold uppercase">Credits</div>
                    </div>
                    <div className="text-right">
                        <div className="text-xl font-bold text-slate-900 dark:text-white">KSh {(smsCreditsToBuy * 1.5).toLocaleString()}</div>
                        <div className="text-xs text-slate-500">@ 1.50 / SMS</div>
                    </div>
                </div>

                <button
                    onClick={initiateSmsPurchase}
                    className="w-full py-4 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-200 dark:shadow-none transition-colors flex items-center justify-center gap-2"
                >
                    Proceed to Payment <ArrowRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );

    // --- NEW: Payment Simulation Modal ---
    const renderCheckout = () => (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                {paymentStep === 'review' && checkoutItem && (
                    <div className="p-6">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Confirm Payment</h3>
                        <div className="space-y-4 mb-6">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500 dark:text-slate-400">{checkoutItem.name}</span>
                                <span className="font-bold dark:text-white">{checkoutItem.amount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500 dark:text-slate-400">Tax (16% VAT)</span>
                                <span className="font-bold dark:text-white">{(checkoutItem.amount * 0.16).toLocaleString()}</span>
                            </div>
                            <div className="border-t border-slate-100 dark:border-slate-700 pt-4 flex justify-between text-lg font-bold text-slate-900 dark:text-white">
                                <span>Total</span>
                                <span>KSh {(checkoutItem.amount * 1.16).toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl mb-6 flex items-center gap-3">
                            <div className="p-2 bg-white dark:bg-slate-600 rounded shadow-sm">
                                {formData.billing.paymentMethod.type === 'M-Pesa' ? <Smartphone className="w-5 h-5 text-green-600" /> : <CreditCard className="w-5 h-5 text-indigo-600" />}
                            </div>
                            <div className="flex-1">
                                <div className="text-xs text-slate-500 uppercase font-bold">Pay with</div>
                                <div className="text-sm font-bold dark:text-white">{formData.billing.paymentMethod.type} •••• {formData.billing.paymentMethod.last4}</div>
                            </div>
                            <button onClick={() => { setShowPaymentModal(true); setShowCheckout(false); }} className="text-xs text-teal-600 font-bold hover:underline">Change</button>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setShowCheckout(false)} className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">Cancel</button>
                            <button onClick={processPayment} className="flex-1 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-opacity">Pay Now</button>
                        </div>
                    </div>
                )}

                {paymentStep === 'processing' && (
                    <div className="p-12 flex flex-col items-center text-center">
                        <div className="relative w-20 h-20 mb-6">
                            <div className="absolute inset-0 border-4 border-slate-100 dark:border-slate-700 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-teal-500 rounded-full border-t-transparent animate-spin"></div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Processing Payment</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm animate-pulse">{processingStatus}</p>
                    </div>
                )}

                {paymentStep === 'success' && (
                    <div className="p-8 flex flex-col items-center text-center animate-in zoom-in">
                        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center mb-6">
                            <Check className="w-10 h-10" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Success!</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-8">Your transaction has been processed successfully.</p>
                        <button onClick={() => { setShowCheckout(false); setShowPricingModal(false); }} className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl">Done</button>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="p-3 sm:p-5 md:p-8 bg-gray-50 dark:bg-slate-900 min-h-screen transition-colors duration-200">
            <div className="mb-6 sm:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="text-center md:text-left">
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Settings</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm sm:text-base">Manage account and clinic preferences</p>
                </div>
                <div className={`flex gap-3 transition-all duration-300 ${hasChanges ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                    <button onClick={handleCancel} className="px-5 py-2.5 text-slate-500 dark:text-slate-400 font-medium hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2.5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 shadow-lg shadow-teal-200 dark:shadow-none transition-colors flex items-center gap-2"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Sidebar nav for settings - Mobile: Horizontal scroll, Desktop: Vertical sticky */}
                <div className="lg:col-span-3 flex lg:flex-col overflow-x-auto lg:overflow-x-visible space-x-2 lg:space-x-0 lg:space-y-2 lg:sticky lg:top-24 pb-4 lg:pb-0 scrollbar-none">
                    {[
                        { id: 'general', label: 'General', icon: Layout },
                        { id: 'team', label: 'Team Members', icon: Users },
                        { id: 'notifications', label: 'Notifications', icon: Bell },
                        { id: 'integrations', label: 'Integrations', icon: Link },
                        { id: 'security', label: 'Security & Access', icon: Shield },
                        { id: 'billing', label: 'Billing & Plans', icon: CreditCard },
                        { id: 'logs', label: 'Audit Logs', icon: Activity },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as Tab)}
                            className={`flex-shrink-0 lg:w-full text-left px-4 py-3.5 font-medium rounded-xl flex items-center justify-between transition-all duration-200 ${activeTab === item.id
                                ? 'bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-400 shadow-md ring-1 ring-slate-100 dark:ring-slate-700'
                                : 'text-slate-500 hover:bg-white/50 dark:text-slate-400 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`} />
                                {item.label}
                            </div>
                            {activeTab === item.id && <ChevronRight className="w-4 h-4 text-teal-600 dark:text-teal-400" />}
                        </button>
                    ))}

                    {/* Theme Toggle in Sidebar - Hidden on mobile here, moved to main header? No, just made horizontal as well or keep it simple */}
                    <div className="lg:pt-4 lg:mt-4 lg:border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
                        <button
                            onClick={toggleTheme}
                            className="flex items-center justify-between p-3.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors gap-3"
                        >
                            <div className="flex items-center gap-3">
                                {isDarkMode ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
                                <span className="hidden lg:inline">{isDarkMode ? 'Dark Mode' : 'Light Mode'}</span>
                            </div>
                            <div className={`w-10 h-6 rounded-full relative transition-colors ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isDarkMode ? 'left-5' : 'left-1'}`}></div>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="lg:col-span-9">
                    {activeTab === 'general' && renderGeneral()}
                    {activeTab === 'notifications' && renderNotifications()}
                    {activeTab === 'integrations' && renderIntegrations()}
                    {activeTab === 'security' && renderSecurity()}
                    {activeTab === 'billing' && renderBilling()}
                    {activeTab === 'team' && renderTeam()}
                    {activeTab === 'logs' && renderLogs()}
                </div>
            </div>

            {/* Global Modals for Billing */}
            {showPricingModal && renderPricingModal()}
            {showSMSModal && renderSMSModal()}
            {showCheckout && renderCheckout()}

            {/* Delete Clinic Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Delete Clinic Account</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">This action cannot be easily undone</p>
                            </div>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl">
                                <p className="text-sm text-red-800 dark:text-red-300 font-medium mb-2">What happens when you delete:</p>
                                <ul className="text-xs text-red-700 dark:text-red-400 space-y-1 list-disc list-inside">
                                    <li>Your clinic status will be set to "cancelled"</li>
                                    <li>All data will be preserved but marked as inactive</li>
                                    <li>You can request restoration within 30 days</li>
                                    <li>After 30 days, data may be permanently deleted</li>
                                </ul>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    Reason for deletion (optional)
                                </label>
                                <textarea
                                    value={deleteReason}
                                    onChange={(e) => setDeleteReason(e.target.value)}
                                    placeholder="e.g., Switching to another platform, closing clinic..."
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white resize-none h-24"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    Type <span className="font-bold text-red-600">{organization?.name || 'DELETE'}</span> to confirm
                                </label>
                                <input
                                    type="text"
                                    value={deleteConfirmation}
                                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                                    placeholder={organization?.name || 'DELETE'}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white font-mono"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setDeleteConfirmation('');
                                    setDeleteReason('');
                                    setError('');
                                }}
                                disabled={isDeleting}
                                className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteClinic}
                                disabled={isDeleting || deleteConfirmation !== (organization?.name || 'DELETE')}
                                className="flex-1 py-3 font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-4 h-4" />
                                        Delete Account
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;

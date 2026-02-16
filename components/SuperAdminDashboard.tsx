import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clinic, ApprovalRequest, TeamMember, SaaSTransaction, SaaSPlatformSettings, SystemLog, SupportTicket } from '../types';
import { db } from '../services/db';
// Removed mock imports - using real data only
import {
    Shield, Activity, DollarSign, Building2, CheckCircle, XCircle, MoreHorizontal,
    Search, Filter, Smartphone, CreditCard, ChevronDown, Download, AlertTriangle,
    Settings, ToggleLeft, ToggleRight, Trash2, Eye, Mail, Server, ArrowUpRight, Save,
    FileText, UserCheck, Ban, Check, X, KeyRound, Loader2, PieChart as PieIcon,
    Plus, MessageSquare, RefreshCw, Database, Undo2, Play, Calendar, Landmark, Receipt,
    LifeBuoy, ChevronLeft, ChevronRight, HardDrive, Printer, Copy, Send, User, LogOut, Bell,
    History, Paperclip, Smile, Layers
} from 'lucide-react';
import { canCurrentUser } from '../lib/roleMapper'
import useStore from '../store'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend, ComposedChart, Line } from 'recharts';

interface SuperAdminDashboardProps {
    currentUser: TeamMember;
    team: TeamMember[];
    activeTab: 'overview' | 'clinics' | 'approvals' | 'payments' | 'settings' | 'support';
    onLogout: () => void;
    switchUser?: (user: TeamMember) => void;
}

const COLORS = {
    primary: '#4f46e5',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    neutral: '#94a3b8',
    dark: '#1e293b'
};

// -- Reusable Pagination Component --
const Pagination: React.FC<{
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}> = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;
    return (
        <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
            <span className="text-sm text-slate-500 dark:text-slate-400">
                Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
                <button
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-2 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-600 dark:text-slate-300"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-600 dark:text-slate-300"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ currentUser, team, activeTab, onLogout, switchUser }) => {

    const navigate = useNavigate();
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [dateFilter, setDateFilter] = useState<'Day' | 'Month' | 'Year'>('Month');
    const [showDateMenu, setShowDateMenu] = useState(false);

    // Notifications
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);

    useEffect(() => {
        const fetchNotifications = async () => {
            if (currentUser?.id) {
                const notes = await db.getNotifications(currentUser.id);
                setNotifications(notes);
            }
        };
        fetchNotifications();
    }, [currentUser]);

    // -- Data State --
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [requests, setRequests] = useState<ApprovalRequest[]>([]);
    const [transactions, setTransactions] = useState<SaaSTransaction[]>([]);
    const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
    const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
    const [platformSettings, setPlatformSettings] = useState<SaaSPlatformSettings>({
        maintenanceMode: false,
        allowNewRegistrations: true,
        globalAnnouncement: '',
        pricing: { free: 0, pro: 5000, enterprise: 15000 },
        gateways: {
            mpesa: { paybill: '522522', account: 'JUAAFYA', name: 'JuaAfya Ltd', enabled: true },
            bank: { name: 'KCB Bank', branch: 'Head Office', account: '1100223344', swift: 'KCBLKENX', enabled: true },
            paystack: { publicKey: '', secretKey: '', enabled: false }
        }
    });

    // -- Pagination State --
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    // -- UI State --
    const [isProcessing, setIsProcessing] = useState<string | null>(null); // Stores ID of processing item or 'global'
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
    const [settingsSubTab, setSettingsSubTab] = useState<'general' | 'pricing' | 'logs' | 'backups'>('general');
    const [paymentsSubTab, setPaymentsSubTab] = useState<'transactions' | 'gateways' | 'subscriptions'>('transactions');

    // -- Modal State --
    const [showAddClinic, setShowAddClinic] = useState(false);
    const [showBroadcast, setShowBroadcast] = useState(false);
    const [showRecordPayment, setShowRecordPayment] = useState(false);
    const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
    const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);

    // New Modals
    const [showInvoice, setShowInvoice] = useState(false);
    const [currentInvoiceData, setCurrentInvoiceData] = useState<any>(null);

    const [showBackupProgress, setShowBackupProgress] = useState(false);
    const [backupType, setBackupType] = useState<'create' | 'restore'>('create');
    const [backupProgress, setBackupProgress] = useState(0);

    // Ticket Modal
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [ticketReply, setTicketReply] = useState('');
    const [supportSearch, setSupportSearch] = useState('');
    const [supportStatusFilter, setSupportStatusFilter] = useState<'All' | 'Open' | 'Resolved' | 'In Progress'>('All');

    // -- Forms --
    const [newClinicForm, setNewClinicForm] = useState({ name: '', owner: '', email: '', plan: 'Free' });
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [logFilter, setLogFilter] = useState({ type: 'All', search: '' });
    const [expandedClinicId, setExpandedClinicId] = useState<string | null>(null);
    const [showClinicPanel, setShowClinicPanel] = useState(false);
    const [showAssignAdmin, setShowAssignAdmin] = useState(false);
    const [assignAdminForm, setAssignAdminForm] = useState({ email: '' });

    // Payment Recording Form
    const [recordPaymentForm, setRecordPaymentForm] = useState({
        clinicId: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        method: 'Bank Transfer',
        ref: ''
    });




    // -- Filter State --
    const [clinicSearch, setClinicSearch] = useState('');
    const [clinicStatusFilter, setClinicStatusFilter] = useState<'All' | 'Active' | 'Suspended'>('All');
    const [clinicPlanFilter, setClinicPlanFilter] = useState<'All' | 'Free' | 'Pro' | 'Enterprise'>('All');

    const [transactionSearch, setTransactionSearch] = useState('');
    const [transactionStatusFilter, setTransactionStatusFilter] = useState<'All' | 'Success' | 'Pending' | 'Failed'>('All');

    const [approvalFilter, setApprovalFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');
    const [revenueView, setRevenueView] = useState<'Monthly' | 'Annual'>('Monthly');

    // -- Effects --
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    // Reset pagination on tab switch
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, settingsSubTab, paymentsSubTab, supportStatusFilter]);

    // Fetch Data
    useEffect(() => {
        const loadData = async () => {
            if (activeTab === 'overview' || activeTab === 'clinics' || activeTab === 'approvals') {
                try {
                    const data = await db.getAllClinics();
                    console.log("[SuperAdminDashboard] All clinics loaded:", data.length, "clinics");
                    console.log("[SuperAdminDashboard] Clinic statuses:", data.map(c => ({
                        name: c.name,
                        status: c.status,
                        statusLower: c.status?.toLowerCase(),
                        rawStatus: (c as any).rawStatus || 'unknown'
                    })));
                    setClinics(data);

                    // Map ALL clinics to Requests to provide a full history in the Approvals tab
                    // This ensures 'Approved' requests don't disappear on refresh
                    const clinicRequests = data.map(c => {
                        const statusLower = (c.status?.toLowerCase() || '');
                        let reqStatus: 'Pending' | 'Approved' | 'Rejected' = 'Pending';

                        // Map DB Clinic Status -> UI Request Status
                        if (statusLower === 'active') reqStatus = 'Approved';
                        else if (statusLower === 'suspended' || statusLower === 'cancelled') reqStatus = 'Rejected';
                        else if (statusLower === 'pending') reqStatus = 'Pending';
                        else reqStatus = 'Approved'; // Default fallback for established clinics

                        return {
                            id: c.id,
                            type: 'New Clinic' as const,
                            clinicName: c.name,
                            requesterName: c.ownerName,
                            date: c.joinedDate,
                            details: `Plan: ${c.plan}, Email: ${c.email}`,
                            status: reqStatus
                        };
                    });

                    console.log("[SuperAdminDashboard] Clinic requests created:", clinicRequests.length);
                    setRequests(clinicRequests);

                } catch (error) {
                    console.error("Failed to load clinics", error);
                }
            }

            if (activeTab === 'overview' || activeTab === 'payments') {
                try {
                    const txns = await db.getTransactions();
                    setTransactions(txns);
                } catch (error) {
                    console.error("Failed to load transactions", error);
                    // Keep empty array - no fallback to mock
                }
            }

            if (activeTab === 'overview' || activeTab === 'support') {
                try {
                    const tickets = await db.getSupportTickets();
                    setSupportTickets(tickets);
                } catch (error) {
                    console.error("Failed to load tickets", error);
                    // Keep empty array - no fallback to mock
                }
            }

            // Load system logs (for super admin only)
            if (activeTab === 'overview' || activeTab === 'settings') {
                try {
                    const logs = await db.getAuditLogs({ limit: 100 });

                    const systemLogs: SystemLog[] = logs.map((log: any) => ({
                        id: log.id,
                        action: log.action,
                        admin: log.userName,
                        target: log.resourceType,
                        timestamp: log.createdAt,
                        status: log.status
                    }));
                    setSystemLogs(systemLogs);
                } catch (error) {
                    console.error("Failed to load system logs", error);
                }
            }

            // Load Platform Settings
            if (activeTab === 'overview' || activeTab === 'settings') {
                const settings = await db.getPlatformSettings();
                setPlatformSettings(settings);
            }
        };
        loadData();
    }, [activeTab]);

    const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ message, type });
    };

    const simulateAsyncAction = async (id: string, action: () => void) => {
        setIsProcessing(id);
        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network
        action();
        setIsProcessing(null);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        showNotification('Copied to clipboard', 'info');
    };

    // -- Derived Stats --
    const stats = useMemo(() => ({
        totalClinics: clinics.length,
        activeClinics: clinics.filter(c => c.status === 'Active').length,
        pendingRequests: requests.filter(r => r.status === 'Pending').length,
        monthlyRevenue: transactions.filter(t => t.status === 'Success').reduce((acc, t) => acc + t.amount, 0),
        failedPayments: transactions.filter(t => t.status === 'Failed').length,
        openTickets: supportTickets.filter(t => t.status !== 'Resolved').length
    }), [clinics, requests, transactions, supportTickets]);

    const planDistribution = useMemo(() => [
        { name: 'Free', value: clinics.filter(c => c.plan === 'Free').length, color: COLORS.neutral },
        { name: 'Pro', value: clinics.filter(c => c.plan === 'Pro').length, color: COLORS.primary },
        { name: 'Enterprise', value: clinics.filter(c => c.plan === 'Enterprise').length, color: COLORS.success }
    ], [clinics]);

    const recentRevenue = useMemo(() => {
        return transactions.slice(0, 5).map(t => ({
            name: t.date.split('-').slice(1).join('/'),
            amount: t.amount
        })).reverse();
    }, [transactions]);

    const growthData = useMemo(() => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const data = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthName = months[d.getMonth()];
            const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            const val = clinics.filter(c => new Date(c.joinedDate) <= endOfMonth && c.status === 'Active').length;
            data.push({ name: monthName, val });
        }
        return data;
    }, [clinics]);

    const revenueTrend = useMemo(() => {
        const monthly: Record<string, number> = {};
        transactions.forEach(t => {
            if (t.status === 'Success') {
                const d = new Date(t.date);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                monthly[key] = (monthly[key] || 0) + t.amount;
            }
        });
        const trend = Object.keys(monthly).sort().map(k => {
            const [y, m] = k.split('-');
            const name = new Date(parseInt(y), parseInt(m) - 1).toLocaleString('default', { month: 'short' });
            return { name, amount: monthly[k] };
        });
        return trend.slice(-6);
    }, [transactions]);

    const revenueForecast = useMemo(() => {
        const history = [...revenueTrend];
        if (history.length === 0) return [];

        const pricing = platformSettings.pricing;
        const activeClinics = clinics.filter(c => c.status === 'Active');
        const currentMRR = activeClinics.reduce((sum, c) => {
            const price = c.plan === 'Enterprise' ? pricing.enterprise : c.plan === 'Pro' ? pricing.pro : pricing.free;
            return sum + price;
        }, 0);

        // Calculate growth rate or default
        const growthRate = 1.05; // 5% monthly growth

        const data = history.map(h => ({
            name: h.name,
            actual: h.amount as number | null,
            projected: null as number | null
        }));

        // Pivot point
        if (data.length > 0) {
            data[data.length - 1].projected = data[data.length - 1].actual;
        }

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let lastMonthIndex = months.indexOf(history[history.length - 1].name);
        if (lastMonthIndex === -1) lastMonthIndex = new Date().getMonth();

        let currentVal = currentMRR > 0 ? currentMRR : (history[history.length - 1].amount || 0);

        for (let i = 1; i <= 6; i++) {
            currentVal = currentVal * growthRate;
            let nextIndex = (lastMonthIndex + i) % 12;
            data.push({
                name: months[nextIndex],
                actual: null,
                projected: Math.round(currentVal)
            });
        }

        if (revenueView === 'Annual') {
            return data.map(d => ({
                name: d.name,
                actual: d.actual ? d.actual * 12 : null,
                projected: d.projected ? d.projected * 12 : null
            }));
        }

        return data;
    }, [revenueTrend, revenueView, clinics, platformSettings]);

    // -- Helpers --
    const exportToCSV = (data: any[], filename: string) => {
        if (!data.length) {
            showNotification('No data available to export', 'error');
            return;
        }
        const headers = Object.keys(data[0]);
        const rows = data.map(obj => headers.map(header => JSON.stringify(obj[header])).join(','));
        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('Export started successfully', 'success');
    };

    // -- Handlers --

    const handleBackupOperation = (type: 'create' | 'restore') => {
        if (type === 'restore' && !canCurrentUser('super_admin.suspend')) {
            showNotification('Not authorized to restore backups.', 'error')
            return
        }
        if (type === 'restore' && !confirm("CRITICAL WARNING: This will overwrite live data with the selected snapshot. Are you absolutely sure?")) return;

        setBackupType(type);
        setShowBackupProgress(true);
        setBackupProgress(0);

        // Simulate Progress
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.floor(Math.random() * 10) + 5;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                setTimeout(() => {
                    setShowBackupProgress(false);
                    showNotification(type === 'create' ? 'System snapshot created successfully.' : 'System restored from backup.', 'success');
                }, 500);
            }
            setBackupProgress(progress);
        }, 200);
    };

    const handleGenerateInvoice = (transaction: SaaSTransaction | null, clinic?: Clinic) => {
        // If transaction exists, show receipt. If clinic passed, generate new invoice preview.
        const data = transaction || {
            id: `INV-${Date.now()}`,
            clinicName: clinic?.name || 'Unknown Clinic',
            amount: clinic ? platformSettings.pricing[clinic.plan.toLowerCase() as keyof typeof platformSettings.pricing] : 0,
            date: new Date().toISOString().split('T')[0],
            status: 'Unpaid',
            method: 'Pending',
            plan: clinic?.plan || 'Pro'
        };
        setCurrentInvoiceData(data);
        setShowInvoice(true);
    };

    // ... (Existing handlers: handleRecordPayment, handleSaveGateways, etc. preserved) ...
    const handleRecordPayment = async () => {
        if (!recordPaymentForm.clinicId || !recordPaymentForm.amount) return;

        setIsProcessing('record-payment');
        try {
            // 1. Create Transaction
            const clinic = clinics.find(c => c.id === recordPaymentForm.clinicId);
            if (!clinic) throw new Error("Clinic not found");

            const newTx = {
                clinicId: clinic.id,
                amount: parseFloat(recordPaymentForm.amount),
                date: recordPaymentForm.date,
                status: 'Success' as const,
                method: recordPaymentForm.method as any,
                plan: clinic.plan
            };

            await db.createTransaction(newTx);

            // 2. Update Clinic Dates (Add 1 month to nextPaymentDate)
            const nextDate = new Date(clinic.nextPaymentDate !== '-' ? clinic.nextPaymentDate : new Date());
            nextDate.setMonth(nextDate.getMonth() + 1);
            const nextPaymentDateStr = nextDate.toISOString().split('T')[0];

            await db.updateClinic(clinic.id, {
                lastPaymentDate: recordPaymentForm.date,
                nextPaymentDate: nextPaymentDateStr,
                revenueYTD: clinic.revenueYTD + parseFloat(recordPaymentForm.amount)
            });

            // Update UI State locally
            setTransactions(prev => [{ ...newTx, id: `TX-${Date.now()}`, clinicName: clinic.name } as SaaSTransaction, ...prev]);
            setClinics(prev => prev.map(c => c.id === clinic.id ? {
                ...c,
                lastPaymentDate: recordPaymentForm.date,
                nextPaymentDate: nextPaymentDateStr,
                revenueYTD: c.revenueYTD + parseFloat(recordPaymentForm.amount)
            } : c));

            setShowRecordPayment(false);
            setRecordPaymentForm({ clinicId: '', amount: '', date: new Date().toISOString().split('T')[0], method: 'Bank Transfer', ref: '' });
            showNotification('Payment recorded & subscription extended', 'success');

        } catch (error) {
            console.error(error);
            showNotification('Failed to record payment', 'error');
        } finally {
            setIsProcessing(null);
        }
    };

    const handleSaveGateways = async () => {
        setIsProcessing('save-gateways');
        try {
            await db.savePlatformSettings(platformSettings);
            showNotification('Gateway configuration saved.', 'success');
        } catch (e) {
            showNotification('Failed to save gateways', 'error');
        } finally {
            setIsProcessing(null);
        }
    };

    const handleApproveRequest = async (id: string) => {
        const request = requests.find(r => r.id === id);
        setIsProcessing(id);

        try {
            if (request?.type === 'New Clinic') {
                await db.updateClinic(request.id, { status: 'Active' });
                setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'Approved' } : r));
                setClinics(prev => prev.map(c => c.id === request.id ? { ...c, status: 'Active' } : c));
                showNotification(`Clinic "${request.clinicName}" activated successfully`, 'success');

                // FORCE REFRESH: Fetch fresh list to ensure UI is in sync
                const data = await db.getAllClinics();
                setClinics(data);

            } else {
                setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'Approved' } : r));
                showNotification('Request processed successfully', 'success');
            }
        } catch (e) {
            showNotification('Failed to process request', 'error');
        } finally {
            setIsProcessing(null);
        }
    };

    const handleRejectRequest = async (id: string) => {
        setIsProcessing(id);
        try {
            await db.updateClinic(id, { status: 'Suspended' });
            setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'Rejected' } : r));
            setClinics(prev => prev.map(c => c.id === id ? { ...c, status: 'Suspended' } : c));
            showNotification('Request rejected', 'info');
        } catch (e) {
            showNotification('Failed to reject request', 'error');
        } finally {
            setIsProcessing(null);
        }
    };

    const handleSuspendClinic = async (id: string) => {
        const clinic = clinics.find(c => c.id === id);
        if (!clinic) return;
        const newStatus = clinic.status === 'Active' ? 'Suspended' : 'Active';

        setIsProcessing(id);
        try {
            await db.updateClinic(id, { status: newStatus });
            setClinics(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
            setActionMenuOpenId(null);
            showNotification('Clinic status updated', 'success');
        } catch (e) {
            showNotification('Failed to update status', 'error');
        } finally {
            setIsProcessing(null);
        }
    };

    const handleDeleteClinic = (id: string) => {
        if (!canCurrentUser('super_admin.delete')) {
            showNotification('Not authorized to terminate clinics.', 'error')
            return
        }
        if (confirm('Are you sure? This deletes all tenant data and cannot be undone.')) {
            simulateAsyncAction(id, async () => {
                try {
                    await db.deleteClinic(id);
                    setClinics(prev => prev.filter(c => c.id !== id));
                    setActionMenuOpenId(null);
                    showNotification('Clinic deleted', 'success');
                } catch (e) {
                    showNotification('Failed to delete clinic. Ensure dependencies are removed.', 'error');
                }
            });
        }
    };

    const handleProvisionNewClinic = async () => {
        if (!newClinicForm.name || !newClinicForm.email) return;

        setIsProcessing('add-clinic');
        try {
            const data = await db.createClinic({
                name: newClinicForm.name,
                email: newClinicForm.email,
                plan: newClinicForm.plan as any,
                status: 'Active'
            });

            // Auto-assign admin using the provided email
            if (newClinicForm.email) {
                try {
                    await db.assignClinicAdmin(data.id, newClinicForm.email);
                } catch (assignError) {
                    console.error("Failed to auto-assign admin during provision:", assignError);
                    showNotification('Clinic created but admin assignment failed.', 'info');
                }
            }

            const newClinic: Clinic = {
                id: data.id,
                name: data.name,
                ownerName: newClinicForm.owner || "Pending",
                email: data.email,
                plan: newClinicForm.plan as any,
                status: 'Active',
                joinedDate: new Date().toISOString().split('T')[0],
                lastPaymentDate: '-',
                nextPaymentDate: '-',
                revenueYTD: 0
            };

            setClinics(prev => [newClinic, ...prev]);
            setShowAddClinic(false);
            setNewClinicForm({ name: '', owner: '', email: '', plan: 'Free' });
            showNotification(`Clinic "${newClinic.name}" provisioned successfully`, 'success');
        } catch (error) {
            console.error(error);
            showNotification('Failed to provision clinic', 'error');
        } finally {
            setIsProcessing(null);
        }
    };

    const handleAssignAdmin = async () => {
        if (!selectedClinic || !assignAdminForm.email) return;

        setIsProcessing('assign-admin');
        try {
            await db.assignClinicAdmin(selectedClinic.id, assignAdminForm.email);
            showNotification(`Admin assigned to ${selectedClinic.name}`, 'success');
            setShowAssignAdmin(false);
            setAssignAdminForm({ email: '' });
            // Refresh clinics
            const data = await db.getAllClinics();
            setClinics(data);
        } catch (error) {
            console.error(error);
            showNotification('Failed to assign admin', 'error');
        } finally {
            setIsProcessing(null);
        }
    };

    const handleRefund = async (txId: string) => {
        if (!canCurrentUser('billing.refund')) {
            showNotification('Not authorized to refund transactions.', 'error')
            return
        }
        if (!confirm("Process refund for this transaction?")) return;
        setIsProcessing(txId);
        try {
            await db.updateTransaction(txId, { status: 'Failed' });
            setTransactions(prev => prev.map(t => t.id === txId ? { ...t, status: 'Failed' } : t));
            showNotification(`Refund processed for ${txId}`, 'success');
        } catch (e) {
            showNotification('Failed to process refund', 'error');
        } finally {
            setIsProcessing(null);
        }
    };

    const toggleSettings = async (field: keyof SaaSPlatformSettings) => {
        setPlatformSettings(prev => ({ ...prev, [field]: !prev[field] }));
    };

    const handleBroadcast = async () => {
        if (!broadcastMsg) return;
        setIsProcessing('broadcast');
        try {
            const newSettings = { ...platformSettings, globalAnnouncement: broadcastMsg };
            setPlatformSettings(newSettings);
            await db.savePlatformSettings(newSettings);
            setShowBroadcast(false);
            setBroadcastMsg('');
            showNotification('Global announcement published', 'success');
        } catch (e) {
            showNotification('Failed to publish announcement', 'error');
        } finally {
            setIsProcessing(null);
        }
    };

    const handleResetPassword = async (email: string) => {
        setIsProcessing('reset-pwd');
        try {
            const { supabase } = await import('../lib/supabaseClient');
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (error) throw error;
            showNotification(`Password reset instructions sent to ${email}`, 'success');
        } catch (e) {
            showNotification('Failed to send reset instructions', 'error');
        } finally {
            setIsProcessing(null);
        }
    };

    const handleEmailOwner = (email: string) => {
        window.location.href = `mailto:${email}`;
    };

    const handleSaveSettings = async () => {
        setIsProcessing('save-settings');
        try {
            await db.savePlatformSettings(platformSettings);
            showNotification('Platform configuration saved successfully.', 'success');
        } catch (e) {
            showNotification('Failed to save settings', 'error');
        } finally {
            setIsProcessing(null);
        }
    };

    const handleSavePricing = async () => {
        setIsProcessing('save-pricing');
        try {
            await db.savePlatformSettings(platformSettings);
            showNotification('Pricing tiers updated and published.', 'success');
        } catch (e) {
            showNotification('Failed to save pricing', 'error');
        } finally {
            setIsProcessing(null);
        }
    };

    const handleResolveTicket = async (id: string) => {
        setIsProcessing('resolve-ticket');
        try {
            await db.updateSupportTicket(id, { status: 'Resolved' });
            setSupportTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'Resolved' as const } : t));
            if (selectedTicket && selectedTicket.id === id) {
                setSelectedTicket(prev => prev ? { ...prev, status: 'Resolved' as const } : null);
            }
            showNotification('Ticket marked as resolved', 'success');
        } catch (e) {
            showNotification('Failed to resolve ticket', 'error');
        } finally {
            setIsProcessing(null);
        }
    };

    const handleSendReply = async () => {
        if (!selectedTicket || !ticketReply.trim()) return;

        setIsProcessing('reply');
        try {
            const newMessage = {
                role: 'Admin',
                content: ticketReply,
                author: currentUser?.name || 'Super Admin',
                timestamp: new Date().toISOString()
            };

            // In a real database schema, 'messages' would be a JSONB array
            const currentMessages = (selectedTicket as any).messages || [];
            const updatedMessages = [...currentMessages, newMessage];

            await db.updateSupportTicket(selectedTicket.id, {
                status: 'In Progress' as const,
                messages: updatedMessages
            });

            const updatedTicket: SupportTicket = {
                ...selectedTicket,
                lastUpdate: 'Just now',
                status: 'In Progress',
                messages: updatedMessages
            };

            setSupportTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t));
            setSelectedTicket(updatedTicket);
            setTicketReply('');
            showNotification('Reply sent successfully', 'success');
        } catch (e) {
            showNotification('Failed to send reply', 'error');
        } finally {
            setIsProcessing(null);
        }
    };

    // -- Render Methods --

    const renderOverview = () => (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Clinics', value: stats.totalClinics, icon: <Building2 className="w-6 h-6" />, color: 'indigo', trend: '+2 this month', trendUp: true, bg: 'bg-indigo-500' },
                    { label: 'Monthly Revenue', value: `KSh ${stats.monthlyRevenue.toLocaleString()}`, icon: <DollarSign className="w-6 h-6" />, color: 'green', trend: '+15% vs last month', trendUp: true, bg: 'bg-green-500' },
                    { label: 'Pending Approvals', value: stats.pendingRequests, icon: <Activity className="w-6 h-6" />, color: 'orange', trend: 'Needs attention', trendUp: false, bg: 'bg-orange-500' },
                    { label: 'Active Tickets', value: stats.openTickets, icon: <MessageSquare className="w-6 h-6" />, color: 'rose', trend: '-3 from yesterday', trendUp: true, bg: 'bg-rose-500' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden group hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none transition-all duration-300">
                        <div className={`absolute top-0 right-0 w-24 h-24 ${stat.bg}/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-150 duration-500`}></div>
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{stat.label}</p>
                                <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-2 tracking-tight">{stat.value}</h3>
                            </div>
                            <div className={`p-4 rounded-2xl shadow-inner ${stat.color === 'indigo' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' :
                                stat.color === 'green' ? 'bg-green-50 dark:bg-green-900/20 text-green-600' :
                                    stat.color === 'orange' ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600' :
                                        'bg-rose-50 dark:bg-rose-900/20 text-rose-600'
                                }`}>
                                {stat.icon}
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 relative z-10">
                            <span className={`flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-full ${stat.trendUp ? 'bg-green-50 dark:bg-green-900/20 text-green-600' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600'}`}>
                                {stat.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                {stat.trend}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Growth Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Revenue Growth</h3>
                            <p className="text-sm text-slate-500 font-medium">Platform financial performance over time.</p>
                        </div>
                        <div className="flex bg-slate-100 dark:bg-slate-700/50 p-1.5 rounded-2xl">
                            {['Monthly', 'Annual'].map(v => (
                                <button
                                    key={v}
                                    onClick={() => setRevenueView(v as any)}
                                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${revenueView === v ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueTrend}>
                                <defs>
                                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                                    cursor={{ stroke: '#4f46e5', strokeWidth: 2 }}
                                />
                                <Area type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Plan Distribution */}
                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Market Share</h3>
                    <p className="text-sm text-slate-500 font-medium mb-8">Clinics by subscription tier.</p>
                    <div className="h-[250px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={planDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={8}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {planDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-black text-slate-900 dark:text-white">{stats.totalClinics}</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</span>
                        </div>
                    </div>
                    <div className="mt-8 space-y-3">
                        {planDistribution.map((plan, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-700/30 border border-transparent hover:border-slate-100 transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: plan.color }}></div>
                                    <span className="text-sm font-bold text-slate-700 dark:text-gray-200">{plan.name}</span>
                                </div>
                                <span className="text-sm font-black text-slate-900 dark:text-white">{stats.totalClinics > 0 ? ((plan.value / stats.totalClinics) * 100).toFixed(0) : 0}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Live Activity Feed */}
                <div className="lg:col-span-1 bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <History className="w-5 h-5 text-indigo-600" />
                            System Audit
                        </h3>
                        <button className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:underline">View All</button>
                    </div>
                    <div className="space-y-6">
                        {systemLogs.slice(0, 5).map((log, i) => (
                            <div key={i} className="flex gap-4 relative">
                                {i !== 4 && <div className="absolute left-2 top-8 bottom-0 w-0.5 bg-slate-100 dark:bg-slate-700"></div>}
                                <div className={`w-4 h-4 rounded-full mt-1 shrink-0 border-2 border-white dark:border-slate-800 z-10 ${log.status === 'Success' ? 'bg-green-500' : 'bg-rose-500'}`}></div>
                                <div>
                                    <p className="text-xs font-bold text-slate-800 dark:text-white leading-tight">{log.action}</p>
                                    <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">By {log.admin} • {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                            </div>
                        ))}
                        {systemLogs.length === 0 && <p className="text-center text-slate-400 text-sm">No recent logs.</p>}
                    </div>
                </div>

                {/* Performance & Health */}
                <div className="lg:col-span-2 bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
                    <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-indigo-600/20 rounded-full blur-[100px]"></div>
                    <div className="absolute -left-20 -top-20 w-80 h-80 bg-teal-500/10 rounded-full blur-[100px]"></div>

                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-8">
                                <div className="p-3 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10">
                                    <Shield className="w-6 h-6 text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black tracking-tight">Enterprise Infrastructure</h3>
                                    <p className="text-slate-400 font-medium">Global platform status and health monitoring.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-black uppercase tracking-widest text-slate-400">
                                        <span>Server Availability</span>
                                        <span className="text-teal-400">99.98%</span>
                                    </div>
                                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-teal-400 w-[99%]" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-black uppercase tracking-widest text-slate-400">
                                        <span>DB Optimization</span>
                                        <span className="text-indigo-400">Excellent</span>
                                    </div>
                                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-400 w-[85%]" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 bg-white/5 backdrop-blur-md rounded-3xl border border-white/5 p-6 flex flex-wrap gap-10">
                            <div>
                                <span className="block text-3xl font-black">2.4 TB</span>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1 block">Total Storage</span>
                            </div>
                            <div className="border-l border-white/10 pl-10">
                                <span className="block text-3xl font-black">1.2ms</span>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1 block">Latency</span>
                            </div>
                            <div className="border-l border-white/10 pl-10">
                                <span className="block text-3xl font-black">14.2k</span>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1 block">Request/sec</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderSupport = () => {
        const filteredTickets = supportTickets.filter(t =>
            (supportStatusFilter === 'All' || t.status === supportStatusFilter) &&
            (t.subject.toLowerCase().includes(supportSearch.toLowerCase()) ||
                t.clinicName.toLowerCase().includes(supportSearch.toLowerCase()))
        );

        return (
            <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-220px)] animate-in fade-in duration-500">
                {/* Tickets Sidebar */}
                <div className="lg:w-96 flex flex-col bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden shrink-0">
                    <div className="p-6 border-b border-slate-50 dark:border-slate-700/50">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                placeholder="Search help requests..."
                                value={supportSearch}
                                onChange={(e) => setSupportSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-transparent focus:border-indigo-500 outline-none text-sm transition-all dark:text-white"
                            />
                        </div>
                        <div className="flex gap-2 mt-4 overflow-x-auto pb-2 no-scrollbar">
                            {['All', 'Open', 'In Progress', 'Resolved'].map(s => (
                                <button
                                    key={s}
                                    onClick={() => setSupportStatusFilter(s as any)}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${supportStatusFilter === s ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {filteredTickets.map(ticket => (
                            <button
                                key={ticket.id}
                                onClick={() => setSelectedTicket(ticket)}
                                className={`w-full text-left p-5 rounded-[1.5rem] transition-all border ${selectedTicket?.id === ticket.id
                                    ? 'bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800'
                                    : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{ticket.id}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${ticket.priority === 'High' || ticket.priority === 'Critical' ? 'bg-rose-100 text-rose-600' :
                                        ticket.priority === 'Medium' ? 'bg-orange-100 text-orange-600' :
                                            'bg-green-100 text-green-600'
                                        }`}>
                                        {ticket.priority}
                                    </span>
                                </div>
                                <h4 className="font-bold text-slate-900 dark:text-white line-clamp-1">{ticket.subject}</h4>
                                <div className="flex justify-between items-center mt-3">
                                    <span className="text-xs font-semibold text-slate-500">{ticket.clinicName}</span>
                                    <span className="text-[10px] text-slate-400 font-bold">{ticket.lastUpdate}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col relative overflow-hidden">
                    {selectedTicket ? (
                        <>
                            <div className="p-8 border-b border-slate-50 dark:border-slate-700/50 flex justify-between items-center bg-white dark:bg-slate-800 sticky top-0 z-10">
                                <div className="flex items-center gap-5">
                                    <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                                        <LifeBuoy className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{selectedTicket.subject}</h3>
                                        <p className="text-sm text-slate-500 font-medium">{selectedTicket.clinicName} • Ticket ID: {selectedTicket.id}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border ${selectedTicket.status === 'Resolved' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                        {selectedTicket.status}
                                    </div>
                                    {selectedTicket.status !== 'Resolved' && (
                                        <button
                                            onClick={() => handleResolveTicket(selectedTicket.id)}
                                            className="p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-green-500 hover:text-white hover:border-green-500 transition-all text-slate-400 shadow-sm"
                                            title="Mark Resolved"
                                        >
                                            <CheckCircle className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-slate-50/30 dark:bg-transparent">
                                <div className="flex flex-col gap-6">
                                    {/* System Note */}
                                    <div className="self-center px-4 py-2 bg-slate-100 dark:bg-slate-900/50 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        Support Session Started • {selectedTicket.dateCreated}
                                    </div>

                                    {/* Messages from Database */}
                                    {selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                                        selectedTicket.messages.map((msg: any, i: number) => (
                                            <div key={i} className={`flex gap-4 max-w-[80%] ${msg.role === 'admin' ? 'self-end flex-row-reverse text-right' : ''}`}>
                                                <div className={`w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center font-black text-xs ${msg.role === 'admin' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                                                    {msg.role === 'admin' ? 'SA' : 'CL'}
                                                </div>
                                                <div className={`space-y-2 ${msg.role === 'admin' ? 'text-right items-end flex flex-col' : ''}`}>
                                                    <div className={`p-6 rounded-3xl border shadow-sm ${msg.role === 'admin' ? 'bg-indigo-600 border-transparent text-white' : 'bg-white dark:bg-slate-700 border-slate-100 dark:border-slate-600 shadow-sm rounded-tl-none'}`}>
                                                        <p className="text-sm font-medium leading-relaxed">
                                                            {msg.content}
                                                        </p>
                                                    </div>
                                                    <span className={`text-[10px] font-black text-slate-400 uppercase ${msg.role === 'admin' ? 'mr-2' : 'ml-2'}`}>
                                                        {msg.timestamp || selectedTicket.lastUpdate}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <>
                                            {/* Fallback for tickets with no messages yet (Initial subject as first message) */}
                                            <div className="flex gap-4 max-w-[80%]">
                                                <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-700 shrink-0 flex items-center justify-center text-slate-400 font-black text-xs">CL</div>
                                                <div className="space-y-2">
                                                    <div className="p-6 bg-white dark:bg-slate-700 rounded-3xl rounded-tl-none border border-slate-100 dark:border-slate-600 shadow-sm">
                                                        <p className="text-sm text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
                                                            Ticket subject: {selectedTicket.subject}
                                                        </p>
                                                    </div>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase ml-2">{selectedTicket.dateCreated}</span>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="p-8 border-t border-slate-50 dark:border-slate-700/50 bg-white dark:bg-slate-800">
                                {selectedTicket.status === 'Resolved' ? (
                                    <div className="flex items-center justify-center p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-2xl gap-3">
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                        <span className="text-sm font-bold text-green-700 dark:text-green-400">This ticket has been resolved. Open a new ticket if issues persist.</span>
                                    </div>
                                ) : (
                                    <div className="flex gap-4 items-end">
                                        <div className="flex-1 relative">
                                            <textarea
                                                value={ticketReply}
                                                onChange={(e) => setTicketReply(e.target.value)}
                                                placeholder="Type your response to the clinic owner..."
                                                className="w-full p-5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-3xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/20 transition-all text-sm resize-none dark:text-white"
                                                rows={3}
                                            />
                                            <div className="absolute bottom-4 right-4 flex gap-2">
                                                <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Paperclip className="w-5 h-5" /></button>
                                                <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Smile className="w-5 h-5" /></button>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleSendReply}
                                            disabled={!ticketReply.trim() || isProcessing === 'reply'}
                                            className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 dark:shadow-none disabled:opacity-50 shrink-0"
                                        >
                                            <Send className="w-6 h-6" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                            <div className="w-24 h-24 bg-slate-50 dark:bg-slate-700/50 rounded-[2.5rem] flex items-center justify-center text-slate-300 dark:text-slate-600 mb-8 border border-slate-100 dark:border-slate-700">
                                <LifeBuoy className="w-12 h-12" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Select a Conversation</h3>
                            <p className="text-slate-500 max-w-xs font-medium">Choose a ticket from the sidebar to view detailed history and reply.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderClinics = () => {
        const filteredClinics = clinics.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(clinicSearch.toLowerCase()) || c.ownerName.toLowerCase().includes(clinicSearch.toLowerCase());
            const matchesStatus = clinicStatusFilter === 'All' || c.status === clinicStatusFilter;
            const matchesPlan = clinicPlanFilter === 'All' || c.plan === clinicPlanFilter;
            return matchesSearch && matchesStatus && matchesPlan;
        });

        const paginatedClinics = filteredClinics.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
        const totalPages = Math.ceil(filteredClinics.length / itemsPerPage);

        return (
            <div className="space-y-6 animate-in fade-in duration-500 relative">
                {/* Search & Filters */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-6">
                    <div className="flex flex-wrap items-center gap-4 flex-1">
                        <div className="relative flex-1 min-w-[240px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                placeholder="Search clinics, owners, or IDs..."
                                value={clinicSearch}
                                onChange={(e) => setClinicSearch(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-[1.25rem] border border-transparent focus:border-indigo-500 outline-none text-sm transition-all dark:text-white"
                            />
                        </div>
                        <select
                            value={clinicStatusFilter}
                            onChange={(e) => setClinicStatusFilter(e.target.value as any)}
                            className="bg-slate-50 dark:bg-slate-900 px-5 py-3 rounded-[1.25rem] text-sm font-bold border border-transparent outline-none dark:text-white cursor-pointer"
                        >
                            <option value="All">All Status</option>
                            <option value="Active">Active Only</option>
                            <option value="Suspended">Suspended</option>
                        </select>
                        <select
                            value={clinicPlanFilter}
                            onChange={(e) => setClinicPlanFilter(e.target.value as any)}
                            className="bg-slate-50 dark:bg-slate-900 px-5 py-3 rounded-[1.25rem] text-sm font-bold border border-transparent outline-none dark:text-white cursor-pointer"
                        >
                            <option value="All">All Plans</option>
                            <option value="Free">Free</option>
                            <option value="Pro">Pro</option>
                            <option value="Enterprise">Enterprise</option>
                        </select>
                    </div>
                    <button
                        onClick={() => setShowAddClinic(true)}
                        className="bg-indigo-600 text-white px-8 py-3 rounded-[1.25rem] text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-none"
                    >
                        <Plus className="w-5 h-5" /> Provision Clinic
                    </button>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto overflow-y-visible">
                        <table className="w-full text-left text-sm border-collapse min-w-[1000px]">
                            <thead className="bg-slate-50/50 dark:bg-slate-700/30 text-[10px] uppercase text-slate-400 font-black tracking-widest border-b border-slate-50 dark:border-slate-700">
                                <tr>
                                    <th className="px-8 py-5">Clinic & ID</th>
                                    <th className="px-8 py-5">Owner</th>
                                    <th className="px-8 py-5">Subscription</th>
                                    <th className="px-8 py-5">Status</th>
                                    <th className="px-8 py-5">Revenue YTD</th>
                                    <th className="px-8 py-5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                {paginatedClinics.map(clinic => (
                                    <tr
                                        key={clinic.id}
                                        className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/5 transition-colors cursor-pointer group"
                                        onClick={() => {
                                            setSelectedClinic(clinic);
                                            setShowClinicPanel(true);
                                        }}
                                    >
                                        <td className="px-8 py-6">
                                            <div>
                                                <p className="font-black text-slate-900 dark:text-white text-base group-hover:text-indigo-600 transition-colors">{clinic.name}</p>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mt-1">{clinic.id}</p>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 font-black text-xs">
                                                    {clinic.ownerName.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 dark:text-slate-200">{clinic.ownerName}</p>
                                                    <p className="text-xs text-slate-500">{clinic.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${clinic.plan === 'Enterprise' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none' :
                                                clinic.plan === 'Pro' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                                                    'bg-slate-100 text-slate-600 border border-slate-200'
                                                }`}>
                                                {clinic.plan}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${clinic.status === 'Active' ? 'bg-green-500' : 'bg-rose-500'} shadow-sm`} />
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${clinic.status === 'Active' ? 'text-green-600' : 'text-rose-600'}`}>
                                                    {clinic.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="font-black text-slate-900 dark:text-white">KSh {clinic.revenueYTD.toLocaleString()}</div>
                                            <div className="text-[10px] font-black text-slate-400 uppercase mt-0.5">Joined {clinic.joinedDate}</div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="relative inline-block" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => setActionMenuOpenId(actionMenuOpenId === clinic.id ? null : clinic.id)}
                                                    className="p-3 hover:bg-white dark:hover:bg-slate-700 rounded-2xl transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-600"
                                                >
                                                    <MoreHorizontal className="w-5 h-5 text-slate-400" />
                                                </button>
                                                {actionMenuOpenId === clinic.id && (
                                                    <div className="absolute right-0 mt-3 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                                        <div className="p-2 space-y-1">
                                                            <button onClick={() => { setSelectedClinic(clinic); setShowAssignAdmin(true); setActionMenuOpenId(null); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors">
                                                                <UserCheck className="w-4 h-4 text-teal-500" /> Assign Admin
                                                            </button>
                                                            <button onClick={() => { setSelectedClinic(clinic); setShowClinicPanel(true); setActionMenuOpenId(null); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors">
                                                                <Eye className="w-4 h-4 text-indigo-500" /> View Details
                                                            </button>
                                                            <button onClick={() => { if (!canCurrentUser('super_admin.suspend')) { try { useStore.getState().actions.showToast('Not authorized to suspend clinics.', 'error') } catch (e) { alert('Not authorized to suspend clinics.') } setActionMenuOpenId(null); return } handleSuspendClinic(clinic.id); setActionMenuOpenId(null); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors">
                                                                {clinic.status === 'Active' ? <Ban className="w-4 h-4 text-orange-500" /> : <CheckCircle className="w-4 h-4 text-green-500" />}
                                                                {clinic.status === 'Active' ? 'Suspend Access' : 'Reactivate'}
                                                            </button>
                                                            <div className="h-px bg-slate-50 dark:bg-slate-700 my-1"></div>
                                                            <button onClick={() => { if (!canCurrentUser('super_admin.delete')) { try { useStore.getState().actions.showToast('Not authorized to terminate clinics.', 'error') } catch (e) { alert('Not authorized to terminate clinics.') } setActionMenuOpenId(null); return } handleDeleteClinic(clinic.id); setActionMenuOpenId(null); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors">
                                                                <Trash2 className="w-4 h-4" /> Terminate Account
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                </div>

                {/* Clinic Detail Side Panel */}
                {showClinicPanel && selectedClinic && (
                    <div className="fixed inset-0 z-[100] overflow-hidden">
                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowClinicPanel(false)}></div>
                        <div className="absolute top-0 right-0 w-full max-w-2xl h-full bg-white dark:bg-slate-800 shadow-2xl animate-in slide-in-from-right duration-500 border-l border-slate-100 dark:border-slate-700">
                            <div className="h-full flex flex-col">
                                <div className="p-8 border-b border-slate-50 dark:border-slate-700/50 flex justify-between items-center sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl z-10">
                                    <div className="flex items-center gap-4">
                                        <button onClick={() => setShowClinicPanel(false)} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                                            <ChevronRight className="w-5 h-5" />
                                        </button>
                                        <div>
                                            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">{selectedClinic.name}</h3>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{selectedClinic.id}</p>
                                        </div>
                                    </div>
                                    <div className={`px-5 py-2 rounded-2xl text-xs font-black uppercase tracking-widest ${selectedClinic.status === 'Active' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                        {selectedClinic.status}
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-10 space-y-12 no-scrollbar">
                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-3 gap-6">
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Plan Type</p>
                                            <p className="text-lg font-black text-slate-900 dark:text-white">{selectedClinic.plan}</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Revenue</p>
                                            <p className="text-lg font-black text-slate-900 dark:text-white">KSh {selectedClinic.revenueYTD.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Joined</p>
                                            <p className="text-lg font-black text-slate-900 dark:text-white">{selectedClinic.joinedDate}</p>
                                        </div>
                                    </div>

                                    {/* Owner Details */}
                                    <section>
                                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                            <User className="w-4 h-4" /> Owner Information
                                        </h4>
                                        <div className="bg-white dark:bg-slate-700/30 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm space-y-6">
                                            <div className="flex justify-between items-center py-4 border-b border-slate-50 dark:border-slate-700 font-bold">
                                                <span className="text-slate-500 text-sm">Full Name</span>
                                                <span className="text-slate-900 dark:text-white">{selectedClinic.ownerName}</span>
                                            </div>
                                            <div className="flex justify-between items-center py-4 border-b border-slate-50 dark:border-slate-700 font-bold">
                                                <span className="text-slate-500 text-sm">Email Address</span>
                                                <span className="text-slate-900 dark:text-white">{selectedClinic.email}</span>
                                            </div>
                                            <div className="flex justify-between items-center py-4 font-bold">
                                                <span className="text-slate-500 text-sm">Contact Phone</span>
                                                <span className="text-slate-900 dark:text-white">{selectedClinic.email.includes('test') ? '+254 700 000000' : 'Not Provided'}</span>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Subscription History */}
                                    <section>
                                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                            <CreditCard className="w-4 h-4" /> Payment Record
                                        </h4>
                                        <div className="space-y-4">
                                            {transactions
                                                .filter(t => t.clinicId === selectedClinic.id || t.clinicName === selectedClinic.name) // Fallback for clinic name if id not in txn (though it should be)
                                                .slice(0, 5) // Last 5 payments
                                                .map((pay, i) => (
                                                    <div key={i} className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-900 rounded-[1.5rem] border border-slate-100 dark:border-slate-700">
                                                        <div>
                                                            <p className="font-bold text-slate-900 dark:text-white">Subscription Renewal</p>
                                                            <p className="text-xs text-slate-500 mt-0.5">{pay.date} • {pay.method}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="font-black text-slate-900 dark:text-white">KSh {pay.amount.toLocaleString()}</p>
                                                            <p className={`text-[10px] font-black uppercase mt-0.5 ${pay.status === 'Success' ? 'text-green-600' : 'text-rose-600'}`}>{pay.status}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            {transactions.filter(t => t.clinicName === selectedClinic.name).length === 0 && (
                                                <div className="p-8 text-center bg-slate-50 dark:bg-slate-900 rounded-[1.5rem] border border-dashed border-slate-200 dark:border-slate-700">
                                                    <p className="text-sm text-slate-400">No payment records found.</p>
                                                </div>
                                            )}
                                            <button
                                                onClick={() => {
                                                    setTransactionSearch(selectedClinic.name);
                                                    setTransactionStatusFilter('All');
                                                    navigate('/sa-payments');
                                                }}
                                                className="w-full py-4 text-xs font-black text-indigo-600 uppercase tracking-widest border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-[1.5rem] hover:bg-slate-50 transition-all"
                                            >
                                                View Complete Transaction History
                                            </button>
                                        </div>
                                    </section>

                                    {/* Critical Actions */}
                                    <section className="pt-8 border-t border-slate-100 dark:border-slate-700 overflow-hidden">
                                        <h4 className="text-xs font-bold text-rose-500 uppercase tracking-widest mb-6">Danger Zone</h4>
                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => { handleSuspendClinic(selectedClinic.id); setShowClinicPanel(false); }}
                                                className="flex-1 py-4 bg-orange-50 text-orange-600 rounded-[1.5rem] text-xs font-black uppercase tracking-widest hover:bg-orange-600 hover:text-white transition-all"
                                            >
                                                {selectedClinic.status === 'Active' ? 'Suspend Account' : 'Reactivate'}
                                            </button>
                                            <button
                                                onClick={() => { handleDeleteClinic(selectedClinic.id); setShowClinicPanel(false); }}
                                                className="flex-1 py-4 bg-rose-50 text-rose-600 rounded-[1.5rem] text-xs font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all"
                                            >
                                                Delete Data
                                            </button>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderApprovals = () => {
        const filteredRequests = requests.filter(r => approvalFilter === 'All' || r.status === approvalFilter);

        return (
            <div className="space-y-6 animate-in fade-in">
                <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <span className="text-sm font-bold text-slate-500">Filter Status:</span>
                    <div className="flex gap-2">
                        {['All', 'Pending', 'Approved', 'Rejected'].map(status => (
                            <button
                                key={status}
                                onClick={() => setApprovalFilter(status as any)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${approvalFilter === status
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                                    }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRequests.map(req => (
                        <div key={req.id} className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden group">
                            <div className={`absolute top-0 left-0 w-1.5 h-full ${req.status === 'Pending' ? 'bg-orange-500' : req.status === 'Approved' ? 'bg-green-500' : 'bg-red-500'
                                }`}></div>
                            <div className="flex justify-between items-start mb-4 pl-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{req.type}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${req.status === 'Pending' ? 'bg-orange-100 text-orange-700' :
                                    req.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                    }`}>{req.status}</span>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 pl-2">{req.clinicName}</h3>
                            <p className="text-sm text-slate-500 pl-2 mb-4">Requester: {req.requesterName}</p>
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl mb-4 ml-2">
                                <p className="text-xs text-slate-600 dark:text-slate-300 italic">"{req.details}"</p>
                            </div>
                            <div className="flex gap-2 pl-2">
                                {req.status === 'Pending' && (
                                    <>
                                        <button
                                            onClick={() => handleApproveRequest(req.id)}
                                            disabled={isProcessing === req.id}
                                            className="flex-1 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 flex items-center justify-center gap-1 disabled:opacity-50"
                                        >
                                            {isProcessing === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Approve
                                        </button>
                                        <button
                                            onClick={() => handleRejectRequest(req.id)}
                                            disabled={isProcessing === req.id}
                                            className="flex-1 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 flex items-center justify-center gap-1 disabled:opacity-50"
                                        >
                                            <X className="w-3 h-3" /> Reject
                                        </button>
                                    </>
                                )}
                                {req.status !== 'Pending' && (
                                    <button className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-lg text-xs font-bold cursor-default">
                                        Processed
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {filteredRequests.length === 0 && <div className="col-span-full text-center py-12 text-slate-400">No requests found.</div>}
                </div>
            </div>
        );
    };

    const renderPayments = () => {
        const filteredTransactions = transactions.filter(t => {
            const matchSearch = t.clinicName.toLowerCase().includes(transactionSearch.toLowerCase()) || t.id.toLowerCase().includes(transactionSearch.toLowerCase());
            const matchStatus = transactionStatusFilter === 'All' || t.status === transactionStatusFilter;
            return matchSearch && matchStatus;
        });

        return (
            <div className="space-y-6 animate-in fade-in">
                {/* Sub-navigation */}
                <div className="flex border-b border-slate-100 dark:border-slate-800 mb-8">
                    <button
                        onClick={() => setPaymentsSubTab('transactions')}
                        className={`px-8 py-4 text-sm font-bold border-b-2 transition-all ${paymentsSubTab === 'transactions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        Transactions
                    </button>
                    <button
                        onClick={() => setPaymentsSubTab('subscriptions')}
                        className={`px-8 py-4 text-sm font-bold border-b-2 transition-all ${paymentsSubTab === 'subscriptions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        Subscriptions
                    </button>
                    <button
                        onClick={() => setPaymentsSubTab('gateways')}
                        className={`px-8 py-4 text-sm font-bold border-b-2 transition-all ${paymentsSubTab === 'gateways' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        Gateways
                    </button>
                </div>

                {paymentsSubTab === 'subscriptions' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {['Free', 'Pro', 'Enterprise'].map(plan => {
                            const planClinics = clinics.filter(c => c.plan === plan);
                            const activeClinics = planClinics.filter(c => c.status === 'Active');
                            const revenue = planClinics.reduce((sum, c) => sum + (c.revenueYTD || 0), 0);

                            return (
                                <div key={plan} className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${plan === 'Free' ? 'bg-slate-100 text-slate-600' :
                                        plan === 'Pro' ? 'bg-indigo-100 text-indigo-600' :
                                            'bg-purple-100 text-purple-600'
                                        }`}>
                                        <Layers className="w-6 h-6" />
                                    </div>
                                    <h4 className="text-xl font-black text-slate-900 dark:text-white mb-2">{plan} Plan</h4>
                                    <div className="space-y-4 mt-6">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-500">Total Clinics</span>
                                            <span className="font-bold text-slate-900 dark:text-white">{planClinics.length}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-500">Active</span>
                                            <span className="font-bold text-green-600">{activeClinics.length}</span>
                                        </div>
                                        <div className="pt-4 border-t border-slate-50 dark:border-slate-700 flex justify-between items-end">
                                            <div>
                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Revenue YTD</p>
                                                <p className="text-lg font-black text-slate-900 dark:text-white">KSh {revenue.toLocaleString()}</p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setClinicPlanFilter(plan as any);
                                                    navigate('/sa-clinics');
                                                }}
                                                className="text-xs font-bold text-indigo-600 hover:underline"
                                            >
                                                Details
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {paymentsSubTab === 'transactions' && (
                    <>
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <div className="relative flex-1 sm:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        placeholder="Search transactions..."
                                        value={transactionSearch}
                                        onChange={(e) => setTransactionSearch(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-transparent focus:border-indigo-500 outline-none text-sm transition-all dark:text-white"
                                    />
                                </div>
                                <select
                                    value={transactionStatusFilter}
                                    onChange={(e) => setTransactionStatusFilter(e.target.value as any)}
                                    className="bg-slate-50 dark:bg-slate-900 px-4 py-2 rounded-xl text-sm font-bold border border-transparent outline-none dark:text-white cursor-pointer"
                                >
                                    <option value="All">All Status</option>
                                    <option value="Success">Success</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Failed">Failed</option>
                                </select>
                            </div>
                            <button onClick={() => setShowRecordPayment(true)} className="w-full sm:w-auto px-6 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-800">
                                <Plus className="w-4 h-4" /> Record manual payment
                            </button>
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm min-w-[1000px]">
                                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 font-bold border-b border-slate-50 dark:border-slate-700">
                                        <tr>
                                            <th className="px-6 py-4">Transaction ID</th>
                                            <th className="px-6 py-4">Clinic</th>
                                            <th className="px-6 py-4">Amount</th>
                                            <th className="px-6 py-4">Method</th>
                                            <th className="px-6 py-4">Date</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
                                        {filteredTransactions.map(tx => (
                                            <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                <td className="px-6 py-4 font-mono text-xs">{tx.id}</td>
                                                <td className="px-6 py-4 font-bold">{tx.clinicName}</td>
                                                <td className="px-6 py-4 font-black text-slate-900 dark:text-white">KSh {tx.amount.toLocaleString()}</td>
                                                <td className="px-6 py-4">
                                                    <span className="flex items-center gap-1.5 capitalize">
                                                        {tx.method === 'M-Pesa' ? <Smartphone className="w-3.5 h-3.5" /> : <Landmark className="w-3.5 h-3.5" />}
                                                        {tx.method}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">{tx.date}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${tx.status === 'Success' ? 'bg-green-100 text-green-700' :
                                                        tx.status === 'Pending' ? 'bg-orange-100 text-orange-700' :
                                                            'bg-red-100 text-red-700'
                                                        }`}>{tx.status}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => handleGenerateInvoice(tx)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="View Receipt">
                                                            <Receipt className="w-4 h-4" />
                                                        </button>
                                                        {tx.status === 'Success' && (
                                                            <button onClick={() => { if (!canCurrentUser('billing.refund')) { try { useStore.getState().actions.showToast('Not authorized to refund transactions.', 'error') } catch (e) { alert('Not authorized to refund transactions.') } return } handleRefund(tx.id) }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Refund">
                                                                <Undo2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {paymentsSubTab === 'gateways' && (
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 max-w-4xl mx-auto">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Payment Gateways</h3>
                            <button
                                onClick={handleSaveGateways}
                                disabled={isProcessing === 'save-gateways'}
                                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isProcessing === 'save-gateways' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
                            </button>
                        </div>

                        <div className="space-y-8">
                            {/* M-Pesa */}
                            <div className={`p-6 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border transition-all ${platformSettings.gateways.mpesa.enabled ? 'border-green-200 dark:border-green-900/30 bg-green-50/50 dark:bg-green-900/10' : 'border-slate-200 dark:border-slate-600'}`}>
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <Smartphone className={`w-6 h-6 ${platformSettings.gateways.mpesa.enabled ? 'text-green-600' : 'text-slate-400'}`} />
                                        <h4 className="text-lg font-bold text-slate-800 dark:text-white">M-Pesa Integration (Daraja API)</h4>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{platformSettings.gateways.mpesa.enabled ? 'Enabled' : 'Disabled'}</span>
                                        <button
                                            onClick={() => setPlatformSettings(prev => ({ ...prev, gateways: { ...prev.gateways, mpesa: { ...prev.gateways.mpesa, enabled: !prev.gateways.mpesa.enabled } } }))}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${platformSettings.gateways.mpesa.enabled ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${platformSettings.gateways.mpesa.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                </div>
                                {platformSettings.gateways.mpesa.enabled && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Paybill Number</label>
                                            <input
                                                value={platformSettings.gateways.mpesa.paybill}
                                                onChange={(e) => setPlatformSettings({ ...platformSettings, gateways: { ...platformSettings.gateways, mpesa: { ...platformSettings.gateways.mpesa, paybill: e.target.value } } })}
                                                className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Account Name</label>
                                            <input
                                                value={platformSettings.gateways.mpesa.name}
                                                onChange={(e) => setPlatformSettings({ ...platformSettings, gateways: { ...platformSettings.gateways, mpesa: { ...platformSettings.gateways.mpesa, name: e.target.value } } })}
                                                className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none dark:text-white"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Bank */}
                            <div className={`p-6 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border transition-all ${platformSettings.gateways.bank.enabled ? 'border-blue-200 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10' : 'border-slate-200 dark:border-slate-600'}`}>
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <Landmark className={`w-6 h-6 ${platformSettings.gateways.bank.enabled ? 'text-blue-600' : 'text-slate-400'}`} />
                                        <h4 className="text-lg font-bold text-slate-800 dark:text-white">Bank Details (Manual Transfer)</h4>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{platformSettings.gateways.bank.enabled ? 'Enabled' : 'Disabled'}</span>
                                        <button
                                            onClick={() => setPlatformSettings(prev => ({ ...prev, gateways: { ...prev.gateways, bank: { ...prev.gateways.bank, enabled: !prev.gateways.bank.enabled } } }))}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${platformSettings.gateways.bank.enabled ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${platformSettings.gateways.bank.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                </div>
                                {platformSettings.gateways.bank.enabled && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Bank Name</label>
                                            <input
                                                value={platformSettings.gateways.bank.name}
                                                onChange={(e) => setPlatformSettings({ ...platformSettings, gateways: { ...platformSettings.gateways, bank: { ...platformSettings.gateways.bank, name: e.target.value } } })}
                                                className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Account Number</label>
                                            <input
                                                value={platformSettings.gateways.bank.account}
                                                onChange={(e) => setPlatformSettings({ ...platformSettings, gateways: { ...platformSettings.gateways, bank: { ...platformSettings.gateways.bank, account: e.target.value } } })}
                                                className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Branch</label>
                                            <input
                                                value={platformSettings.gateways.bank.branch}
                                                onChange={(e) => setPlatformSettings({ ...platformSettings, gateways: { ...platformSettings.gateways, bank: { ...platformSettings.gateways.bank, branch: e.target.value } } })}
                                                className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Swift Code</label>
                                            <input
                                                value={platformSettings.gateways.bank.swift}
                                                onChange={(e) => setPlatformSettings({ ...platformSettings, gateways: { ...platformSettings.gateways, bank: { ...platformSettings.gateways.bank, swift: e.target.value } } })}
                                                className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none dark:text-white"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Paystack */}
                            <div className={`p-6 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border transition-all ${platformSettings.gateways.paystack.enabled ? 'border-indigo-200 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10' : 'border-slate-200 dark:border-slate-600'}`}>
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <CreditCard className={`w-6 h-6 ${platformSettings.gateways.paystack.enabled ? 'text-indigo-600' : 'text-slate-400'}`} />
                                        <h4 className="text-lg font-bold text-slate-800 dark:text-white">Paystack Integration</h4>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{platformSettings.gateways.paystack.enabled ? 'Enabled' : 'Disabled'}</span>
                                        <button
                                            onClick={() => setPlatformSettings(prev => ({ ...prev, gateways: { ...prev.gateways, paystack: { ...prev.gateways.paystack, enabled: !prev.gateways.paystack.enabled } } }))}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${platformSettings.gateways.paystack.enabled ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${platformSettings.gateways.paystack.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                </div>
                                {platformSettings.gateways.paystack.enabled && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                                        <div className="md:col-span-2">
                                            <p className="text-sm text-slate-500 mb-2">Automate subscription collections using Paystack's recurring billing. Paystack supports Card and M-Pesa payments.</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Paystack Public Key</label>
                                            <input
                                                value={platformSettings.gateways.paystack.publicKey}
                                                type="password"
                                                placeholder="pk_test_..."
                                                onChange={(e) => setPlatformSettings({ ...platformSettings, gateways: { ...platformSettings.gateways, paystack: { ...platformSettings.gateways.paystack, publicKey: e.target.value } } })}
                                                className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none dark:text-white font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Paystack Secret Key</label>
                                            <input
                                                value={platformSettings.gateways.paystack.secretKey}
                                                type="password"
                                                placeholder="sk_test_..."
                                                onChange={(e) => setPlatformSettings({ ...platformSettings, gateways: { ...platformSettings.gateways, paystack: { ...platformSettings.gateways.paystack, secretKey: e.target.value } } })}
                                                className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none dark:text-white font-mono"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderSettings = () => {
        const filteredLogs = systemLogs.filter(l =>
            (logFilter.type === 'All' || l.action.toLowerCase().includes(logFilter.type.toLowerCase())) &&
            (l.admin.toLowerCase().includes(logFilter.search.toLowerCase()) || l.target.toLowerCase().includes(logFilter.search.toLowerCase()))
        );

        return (
            <div className="space-y-6 animate-in fade-in">
                <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl w-fit">
                    {['general', 'pricing', 'logs', 'backups'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setSettingsSubTab(tab as any)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all capitalize ${settingsSubTab === tab ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {settingsSubTab === 'general' && (
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 max-w-4xl">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Platform Configuration</h3>
                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-600 rounded-xl">
                                <div>
                                    <div className="font-bold text-slate-800 dark:text-white">Maintenance Mode</div>
                                    <div className="text-xs text-slate-500">Disable access for all non-admin users</div>
                                </div>
                                <button
                                    onClick={() => toggleSettings('maintenanceMode')}
                                    className={`w-12 h-6 rounded-full relative transition-colors ${platformSettings.maintenanceMode ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${platformSettings.maintenanceMode ? 'left-7' : 'left-1'}`}></div>
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-600 rounded-xl">
                                <div>
                                    <div className="font-bold text-slate-800 dark:text-white">Allow New Registrations</div>
                                    <div className="text-xs text-slate-500">Enable new clinics to sign up</div>
                                </div>
                                <button
                                    onClick={() => toggleSettings('allowNewRegistrations')}
                                    className={`w-12 h-6 rounded-full relative transition-colors ${platformSettings.allowNewRegistrations ? 'bg-green-600' : 'bg-slate-300'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${platformSettings.allowNewRegistrations ? 'left-7' : 'left-1'}`}></div>
                                </button>
                            </div>

                            <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block">Global Announcement</label>
                                <div className="flex gap-2">
                                    <input
                                        value={platformSettings.globalAnnouncement}
                                        onChange={(e) => setPlatformSettings({ ...platformSettings, globalAnnouncement: e.target.value })}
                                        className="flex-1 p-3 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 outline-none text-sm dark:text-white"
                                        placeholder="Message visible to all tenants..."
                                    />
                                    <button onClick={handleSaveSettings} className="bg-indigo-600 text-white px-4 rounded-xl text-sm font-bold hover:bg-indigo-700">Save</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {settingsSubTab === 'pricing' && (
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 max-w-4xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Subscription Pricing</h3>
                            <button
                                onClick={handleSavePricing}
                                disabled={isProcessing === 'save-pricing'}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {isProcessing === 'save-pricing' ? 'Saving...' : 'Update Pricing'}
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-6 border-2 border-slate-100 dark:border-slate-700 rounded-2xl">
                                <div className="text-center mb-4">
                                    <h4 className="font-bold text-slate-600 dark:text-slate-400">Free Tier</h4>
                                </div>
                                <div className="flex items-center justify-center gap-1 mb-2">
                                    <span className="text-slate-400 text-sm">KSh</span>
                                    <input
                                        type="number"
                                        value={platformSettings.pricing.free}
                                        onChange={(e) => setPlatformSettings({ ...platformSettings, pricing: { ...platformSettings.pricing, free: parseInt(e.target.value) } })}
                                        className="w-20 p-1 text-center font-bold text-xl bg-transparent border-b border-slate-300 outline-none dark:text-white"
                                    />
                                </div>
                                <p className="text-center text-xs text-slate-400">/ month</p>
                            </div>
                            <div className="p-6 border-2 border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl relative">
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-2 py-0.5 rounded text-[10px] uppercase font-bold">Popular</div>
                                <div className="text-center mb-4">
                                    <h4 className="font-bold text-indigo-700 dark:text-indigo-400">Pro Tier</h4>
                                </div>
                                <div className="flex items-center justify-center gap-1 mb-2">
                                    <span className="text-slate-400 text-sm">KSh</span>
                                    <input
                                        type="number"
                                        value={platformSettings.pricing.pro}
                                        onChange={(e) => setPlatformSettings({ ...platformSettings, pricing: { ...platformSettings.pricing, pro: parseInt(e.target.value) } })}
                                        className="w-24 p-1 text-center font-bold text-xl bg-transparent border-b border-indigo-300 outline-none text-indigo-900 dark:text-white"
                                    />
                                </div>
                                <p className="text-center text-xs text-slate-400">/ month</p>
                            </div>
                            <div className="p-6 border-2 border-slate-100 dark:border-slate-700 rounded-2xl">
                                <div className="text-center mb-4">
                                    <h4 className="font-bold text-slate-600 dark:text-slate-400">Enterprise</h4>
                                </div>
                                <div className="flex items-center justify-center gap-1 mb-2">
                                    <span className="text-slate-400 text-sm">KSh</span>
                                    <input
                                        type="number"
                                        value={platformSettings.pricing.enterprise}
                                        onChange={(e) => setPlatformSettings({ ...platformSettings, pricing: { ...platformSettings.pricing, enterprise: parseInt(e.target.value) } })}
                                        className="w-24 p-1 text-center font-bold text-xl bg-transparent border-b border-slate-300 outline-none dark:text-white"
                                    />
                                </div>
                                <p className="text-center text-xs text-slate-400">/ month</p>
                            </div>
                        </div>
                    </div>
                )}

                {settingsSubTab === 'logs' && (
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                            <h3 className="font-bold text-slate-900 dark:text-white">System Audit Logs</h3>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <input
                                    placeholder="Search logs..."
                                    value={logFilter.search}
                                    onChange={(e) => setLogFilter({ ...logFilter, search: e.target.value })}
                                    className="pl-4 pr-4 py-2 bg-slate-50 dark:bg-slate-700 rounded-lg text-sm outline-none dark:text-white border border-slate-200 dark:border-slate-600 w-full sm:w-64"
                                />
                                <button onClick={() => exportToCSV(filteredLogs, 'audit_logs')} className="p-2 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500">
                                    <Download className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm min-w-[800px]">
                                <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs uppercase text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-700">
                                    <tr>
                                        <th className="px-6 py-4">Timestamp</th>
                                        <th className="px-6 py-4">Action</th>
                                        <th className="px-6 py-4">Admin</th>
                                        <th className="px-6 py-4">Target</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                    {filteredLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                            <td className="px-6 py-4 text-xs font-mono text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{log.action}</td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{log.admin}</td>
                                            <td className="px-6 py-4 text-slate-500">{log.target}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${log.status === 'Success' ? 'bg-green-100 text-green-700' :
                                                    log.status === 'Warning' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                                                    }`}>{log.status}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {settingsSubTab === 'backups' && (
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 max-w-4xl">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Database Backups</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            <div className="p-6 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-200 dark:border-slate-600">
                                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                                    <HardDrive className="w-6 h-6" />
                                </div>
                                <h4 className="font-bold text-slate-900 dark:text-white mb-1">Create Snapshot</h4>
                                <p className="text-xs text-slate-500 mb-4">Manual backup of all tenant databases.</p>
                                <button
                                    onClick={() => handleBackupOperation('create')}
                                    className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700"
                                >
                                    Start Backup
                                </button>
                            </div>

                            <div className="p-6 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-200 dark:border-slate-600">
                                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-full flex items-center justify-center mb-4">
                                    <RefreshCw className="w-6 h-6" />
                                </div>
                                <h4 className="font-bold text-slate-900 dark:text-white mb-1">Restore Data</h4>
                                <p className="text-xs text-slate-500 mb-4">Rollback to a previous system state.</p>
                                <button
                                    onClick={() => handleBackupOperation('restore')}
                                    className="w-full py-2 bg-white dark:bg-slate-600 border border-slate-300 dark:border-slate-500 text-slate-700 dark:text-white rounded-lg text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-500"
                                >
                                    Restore...
                                </button>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Recent Snapshots</h4>
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                        <div className="flex items-center gap-3">
                                            <Database className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm font-mono text-slate-600 dark:text-slate-300">snapshot_v{45 - i}_auto.sql</span>
                                        </div>
                                        <span className="text-xs text-slate-400">{i * 6} hours ago</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="p-6 md:p-10 bg-gray-50 dark:bg-slate-900 min-h-screen transition-colors duration-200">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Shield className="w-8 h-8 text-indigo-600" /> Super Admin Portal
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        {activeTab === 'overview' && 'System Overview'}
                        {activeTab === 'clinics' && 'Tenant Management'}
                        {activeTab === 'approvals' && 'Pending Requests'}
                        {activeTab === 'payments' && 'Financial Transactions & Subscriptions'}
                        {activeTab === 'support' && 'Helpdesk Tickets'}
                        {activeTab === 'settings' && 'Global Configuration'}
                    </p>
                </div>

                {/* Header Actions: Date Filter, Notifications, Profile */}
                <div className="flex items-center gap-3 md:gap-6">

                    {/* Date Filter */}
                    <div className="relative z-40 hidden md:block">
                        <button
                            onClick={() => setShowDateMenu(!showDateMenu)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-bold text-slate-700 dark:text-slate-200"
                        >
                            <Calendar className="w-4 h-4 text-slate-500" />
                            <span>{dateFilter}</span>
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                        </button>
                        {showDateMenu && (
                            <div className="absolute top-full left-0 mt-2 w-32 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-in slide-in-from-top-2 p-1">
                                {['Day', 'Month', 'Year'].map((filter) => (
                                    <button
                                        key={filter}
                                        onClick={() => {
                                            setDateFilter(filter as any);
                                            setShowDateMenu(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${dateFilter === filter ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                    >
                                        {filter}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Notification Bell */}
                    <div className="relative z-40">
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            className="relative w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors"
                        >
                            <Bell className="w-5 h-5" />
                            {notifications.length > 0 && <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-800"></span>}
                        </button>

                        {showNotifications && (
                            <div className="absolute right-0 top-full mt-3 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-in slide-in-from-top-2">
                                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                    <h3 className="font-bold text-slate-900 dark:text-white">Notifications</h3>
                                    <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full">{notifications.length} New</span>
                                </div>
                                <div className="max-h-80 overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                                            No new notifications
                                        </div>
                                    ) : (
                                        notifications.map((note, i) => (
                                            <div key={i} className="p-4 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                <div className="flex gap-3">
                                                    <div className={`mt-1 p-1.5 rounded-full flex-shrink-0 ${note.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                        {note.type === 'error' ? <AlertTriangle className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{note.title}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{note.message}</p>
                                                        <p className="text-[10px] text-slate-400 mt-2">{new Date(note.created_at).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="p-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30 text-center">
                                    <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700">Mark all as read</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Profile Dropdown */}
                    <div className="relative z-50">
                        <button
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                            className="w-10 h-10 rounded-full overflow-hidden border-2 border-white dark:border-slate-700 shadow-md hover:ring-2 hover:ring-indigo-100 dark:hover:ring-slate-600 transition-all focus:outline-none"
                        >
                            <img
                                src={currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=4f46e5&color=fff`}
                                alt={currentUser.name}
                                className="w-full h-full object-cover"
                            />
                        </button>

                        {showProfileMenu && (
                            <div className="absolute right-0 top-full mt-3 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-in slide-in-from-top-2">
                                {/* Header */}
                                <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{currentUser.name}</p>
                                    <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
                                </div>

                                {/* Menu Items */}
                                <div className="p-2 space-y-1">
                                    <button
                                        onClick={() => { navigate('/profile'); setShowProfileMenu(false); }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors"
                                    >
                                        <User className="w-4 h-4" /> My Profile
                                    </button>
                                    <button
                                        onClick={() => { navigate('/settings'); setShowProfileMenu(false); }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors"
                                    >
                                        <Settings className="w-4 h-4" /> Settings
                                    </button>
                                </div>

                                <div className="h-px bg-slate-100 dark:bg-slate-700 mx-2"></div>

                                {/* Footer */}
                                <div className="p-2">
                                    <button
                                        onClick={() => {
                                            if (onLogout) onLogout();
                                            setShowProfileMenu(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                                    >
                                        <LogOut className="w-4 h-4" /> Sign Out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[500px]">
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'clinics' && renderClinics()}
                {activeTab === 'approvals' && renderApprovals()}
                {activeTab === 'payments' && renderPayments()}
                {activeTab === 'support' && renderSupport()}
                {activeTab === 'settings' && renderSettings()}
            </div>

            {/* --- MODALS --- */}

            {/* Ticket Detail Modal */}
            {selectedTicket && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[85vh]">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono text-xs text-slate-500 bg-slate-200 dark:bg-slate-600 px-1.5 py-0.5 rounded">#{selectedTicket.id}</span>
                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${selectedTicket.priority === 'Critical' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                                        }`}>{selectedTicket.priority} Priority</span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedTicket.subject}</h3>
                                <p className="text-sm text-slate-500">{selectedTicket.clinicName} • {selectedTicket.dateCreated}</p>
                            </div>
                            <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900 space-y-4">
                            {/* Mock Conversation */}
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-300 flex-shrink-0 flex items-center justify-center"><User className="w-4 h-4 text-slate-600" /></div>
                                <div className="bg-white dark:bg-slate-700 p-4 rounded-2xl rounded-tl-none shadow-sm max-w-[85%]">
                                    <p className="text-sm text-slate-700 dark:text-slate-200">Hi support, we are facing an issue with the SMS gateway since this morning. Messages are delayed.</p>
                                    <span className="text-[10px] text-slate-400 mt-2 block">10:00 AM</span>
                                </div>
                            </div>

                            <div className="flex gap-3 flex-row-reverse">
                                <div className="w-8 h-8 rounded-full bg-indigo-600 flex-shrink-0 flex items-center justify-center text-white font-bold text-xs">SA</div>
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 p-4 rounded-2xl rounded-tr-none shadow-sm max-w-[85%]">
                                    <p className="text-sm text-indigo-900 dark:text-indigo-200">Hello, thanks for reporting. We are checking the gateway status now.</p>
                                    <span className="text-[10px] text-indigo-400 mt-2 block">10:15 AM</span>
                                </div>
                            </div>

                            {selectedTicket.status === 'Resolved' && (
                                <div className="flex justify-center my-4">
                                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" /> Ticket Resolved
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
                            {selectedTicket.status !== 'Resolved' ? (
                                <div className="flex gap-2">
                                    <textarea
                                        className="flex-1 p-3 bg-slate-50 dark:bg-slate-700 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-sm resize-none"
                                        rows={2}
                                        placeholder="Type your reply..."
                                        value={ticketReply}
                                        onChange={(e) => setTicketReply(e.target.value)}
                                    />
                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={handleSendReply}
                                            disabled={isProcessing === 'reply' || !ticketReply}
                                            className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                                        >
                                            {isProcessing === 'reply' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                        </button>
                                        <button
                                            onClick={() => handleResolveTicket(selectedTicket.id)}
                                            className="p-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-100"
                                            title="Mark Resolved"
                                        >
                                            <CheckCircle className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={async () => {
                                        try {
                                            const reopened = { ...selectedTicket, status: 'Open' as const };
                                            await db.updateSupportTicket(selectedTicket.id, { status: 'Open' });
                                            setSupportTickets(prev => prev.map(t => t.id === selectedTicket.id ? reopened : t));
                                            setSelectedTicket(reopened);
                                            showNotification('Ticket reopened successfully', 'success');
                                        } catch (e) {
                                            showNotification('Failed to reopen ticket', 'error');
                                        }
                                    }}
                                    className="w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600"
                                >
                                    Reopen Ticket
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Invoice Modal */}
            {showInvoice && currentInvoiceData && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-2xl rounded-sm shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                        {/* Invoice Paper Style */}
                        <div className="p-8 flex-1 overflow-y-auto font-serif text-slate-800 bg-white">
                            <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6 mb-6">
                                <div>
                                    <h1 className="text-3xl font-bold tracking-tight mb-2">INVOICE</h1>
                                    <p className="text-sm text-slate-500 font-sans">#{currentInvoiceData.id}</p>
                                </div>
                                <div className="text-right font-sans">
                                    <h2 className="text-xl font-bold text-indigo-600">JuaAfya SaaS Ltd</h2>
                                    <p className="text-xs text-slate-500">Nairobi, Kenya</p>
                                    <p className="text-xs text-slate-500">VAT: P000123456</p>
                                </div>
                            </div>

                            <div className="flex justify-between mb-8 font-sans text-sm">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Bill To:</p>
                                    <p className="font-bold text-lg">{currentInvoiceData.clinicName}</p>
                                    <p className="text-slate-500">Subscription: {currentInvoiceData.plan}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Date:</p>
                                    <p className="font-bold">{currentInvoiceData.date}</p>
                                    <p className="text-xs font-bold text-slate-400 uppercase mt-2 mb-1">Status:</p>
                                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase ${currentInvoiceData.status === 'Success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {currentInvoiceData.status === 'Success' ? 'PAID' : 'UNPAID'}
                                    </span>
                                </div>
                            </div>

                            <table className="w-full mb-8 border-collapse font-sans text-sm">
                                <thead>
                                    <tr className="bg-slate-100 border-y border-slate-200">
                                        <th className="py-3 px-4 text-left font-bold text-slate-600">Description</th>
                                        <th className="py-3 px-4 text-right font-bold text-slate-600">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-slate-100">
                                        <td className="py-4 px-4">JuaAfya {currentInvoiceData.plan} Plan Subscription (Monthly)</td>
                                        <td className="py-4 px-4 text-right">KSh {currentInvoiceData.amount.toLocaleString()}</td>
                                    </tr>
                                    <tr className="border-b border-slate-100">
                                        <td className="py-4 px-4">Tax (16% VAT)</td>
                                        <td className="py-4 px-4 text-right">KSh {(currentInvoiceData.amount * 0.16).toLocaleString()}</td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td className="py-4 px-4 text-right font-bold text-lg">Total</td>
                                        <td className="py-4 px-4 text-right font-bold text-lg">KSh {(currentInvoiceData.amount * 1.16).toLocaleString()}</td>
                                    </tr>
                                </tfoot>
                            </table>

                            <div className="text-center text-xs text-slate-400 font-sans mt-12">
                                <p>Thank you for your business.</p>
                                <p>For inquiries, contact billing@juaafya.com</p>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center font-sans">
                            <button onClick={() => setShowInvoice(false)} className="text-slate-500 font-bold hover:text-slate-700">Close</button>
                            <div className="flex gap-3">
                                <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-white transition-colors">
                                    <Printer className="w-4 h-4" /> Print
                                </button>
                                <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg">
                                    <Download className="w-4 h-4" /> Download PDF
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Backup Progress Modal */}
            {showBackupProgress && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl p-8 shadow-2xl text-center">
                        <div className="mb-6 relative inline-block">
                            <Database className={`w-16 h-16 ${backupType === 'restore' ? 'text-orange-500' : 'text-indigo-500'} animate-pulse`} />
                            <div className="absolute inset-0 border-4 border-indigo-100 rounded-full animate-ping opacity-25"></div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                            {backupType === 'create' ? 'Creating System Snapshot...' : 'Restoring Database...'}
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-8">Please wait. Do not close this window.</p>

                        <div className="w-full bg-slate-100 dark:bg-slate-700 h-4 rounded-full overflow-hidden relative mb-2">
                            <div
                                className={`h-full transition-all duration-300 ${backupType === 'create' ? 'bg-indigo-600' : 'bg-orange-500'}`}
                                style={{ width: `${backupProgress}%` }}
                            ></div>
                        </div>
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{backupProgress}% Complete</p>
                    </div>
                </div>
            )}

            {/* Record Payment Modal */}
            {showRecordPayment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Plus className="w-5 h-5 text-indigo-600" /> Record Offline Payment
                            </h3>
                            <button onClick={() => setShowRecordPayment(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Clinic</label>
                                <select
                                    value={recordPaymentForm.clinicId}
                                    onChange={(e) => {
                                        const cId = e.target.value;
                                        const c = clinics.find(c => c.id === cId);
                                        const planCost = c ? platformSettings.pricing[c.plan.toLowerCase() as keyof typeof platformSettings.pricing] : 0;
                                        setRecordPaymentForm({ ...recordPaymentForm, clinicId: cId, amount: planCost ? planCost.toString() : '' });
                                    }}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                >
                                    <option value="">-- Select Clinic --</option>
                                    {clinics.filter(c => c.plan !== 'Free').map(c => (
                                        <option key={c.id} value={c.id}>{c.name} ({c.plan})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Amount (KSh)</label>
                                <input
                                    type="number"
                                    value={recordPaymentForm.amount}
                                    onChange={(e) => setRecordPaymentForm({ ...recordPaymentForm, amount: e.target.value })}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                    placeholder="5000"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Payment Method</label>
                                <select
                                    value={recordPaymentForm.method}
                                    onChange={(e) => setRecordPaymentForm({ ...recordPaymentForm, method: e.target.value })}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                >
                                    <option value="Bank Transfer">Bank Transfer</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Cheque">Cheque</option>
                                    <option value="M-Pesa">M-Pesa (Manual)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Reference ID (Optional)</label>
                                <input
                                    value={recordPaymentForm.ref}
                                    onChange={(e) => setRecordPaymentForm({ ...recordPaymentForm, ref: e.target.value })}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                    placeholder="Transaction Ref"
                                />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setShowRecordPayment(false)} className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
                                <button
                                    onClick={handleRecordPayment}
                                    disabled={isProcessing === 'record-payment' || !recordPaymentForm.clinicId || !recordPaymentForm.amount}
                                    className="flex-1 py-3 font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isProcessing === 'record-payment' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Clinic Modal */}
            {showAddClinic && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Plus className="w-5 h-5 text-indigo-600" /> Provision New Clinic
                            </h3>
                            <button onClick={() => setShowAddClinic(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Clinic Name</label>
                                <input
                                    value={newClinicForm.name}
                                    onChange={(e) => setNewClinicForm({ ...newClinicForm, name: e.target.value })}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                    placeholder="e.g. City Health Center"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Admin Owner Name</label>
                                <input
                                    value={newClinicForm.owner}
                                    onChange={(e) => setNewClinicForm({ ...newClinicForm, owner: e.target.value })}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                    placeholder="e.g. Dr. John Doe"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Admin Email</label>
                                <input
                                    value={newClinicForm.email}
                                    onChange={(e) => setNewClinicForm({ ...newClinicForm, email: e.target.value })}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                    placeholder="admin@clinic.com"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Initial Plan</label>
                                <select
                                    value={newClinicForm.plan}
                                    onChange={(e) => setNewClinicForm({ ...newClinicForm, plan: e.target.value })}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                >
                                    <option value="Free">Free</option>
                                    <option value="Pro">Pro</option>
                                    <option value="Enterprise">Enterprise</option>
                                </select>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setShowAddClinic(false)} className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
                                <button
                                    onClick={handleProvisionNewClinic}
                                    disabled={isProcessing === 'add-clinic' || !newClinicForm.name}
                                    className="flex-1 py-3 font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isProcessing === 'add-clinic' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Create Clinic
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Broadcast Modal */}
            {showBroadcast && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-teal-600" /> Broadcast System Alert
                            </h3>
                            <button onClick={() => setShowBroadcast(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6" /></button>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">This message will be visible on the dashboard of ALL clinics.</p>
                        <textarea
                            className="w-full p-4 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 outline-none text-sm dark:text-white h-32"
                            placeholder="e.g., System maintenance scheduled for Saturday 2 AM..."
                            value={broadcastMsg}
                            onChange={(e) => setBroadcastMsg(e.target.value)}
                            autoFocus
                        />
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowBroadcast(false)} className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
                            <button
                                onClick={handleBroadcast}
                                disabled={isProcessing === 'broadcast' || !broadcastMsg}
                                className="flex-1 py-3 font-bold text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isProcessing === 'broadcast' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Publish
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign Admin Modal */}
            {showAssignAdmin && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <UserCheck className="w-5 h-5 text-indigo-600" /> Assign Clinic Admin
                            </h3>
                            <button onClick={() => setShowAssignAdmin(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6" /></button>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">
                            Enter the email address of the user you want to make an admin for <strong>{selectedClinic?.name}</strong>.
                            If they don't exist, they will be invited.
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Admin Email</label>
                                <input
                                    value={assignAdminForm.email}
                                    onChange={(e) => setAssignAdminForm({ email: e.target.value })}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                    placeholder="user@example.com"
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-3 mt-2">
                                <button onClick={() => setShowAssignAdmin(false)} className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
                                <button
                                    onClick={handleAssignAdmin}
                                    disabled={isProcessing === 'assign-admin' || !assignAdminForm.email}
                                    className="flex-1 py-3 font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isProcessing === 'assign-admin' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Assign
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toast && (
                <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-bottom-5 z-[60] ${toast.type === 'success' ? 'bg-white dark:bg-slate-800 border-green-500 text-green-600' :
                    toast.type === 'error' ? 'bg-white dark:bg-slate-800 border-red-500 text-red-600' :
                        'bg-white dark:bg-slate-800 border-indigo-500 text-indigo-600'
                    }`}>
                    {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
                        toast.type === 'error' ? <XCircle className="w-5 h-5" /> :
                            <Activity className="w-5 h-5" />}
                    <span className="font-bold text-sm">{toast.message}</span>
                </div>
            )}
        </div>
    );
};

export default SuperAdminDashboard;

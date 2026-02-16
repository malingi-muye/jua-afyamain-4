import React, { useState, useMemo, useEffect } from 'react';
import useStore from '../store'
import { InventoryItem, Supplier, InventoryLog, Visit } from '../types';
import {
    Search, Plus, Package, AlertCircle, Filter, X, Check, Edit2,
    Trash2, Download, ArrowUpDown, RefreshCw, DollarSign, ChevronDown,
    AlertTriangle, History, ChevronLeft, ChevronRight, CheckSquare, Square,
    Truck, Calendar, ClipboardList, Briefcase, Mail, Phone, Tag, Building, CheckCircle,
    Pill, ArrowRight, Receipt, Printer, QrCode
} from 'lucide-react';
import { canCurrentUser } from '../lib/roleMapper'

interface PharmacyProps {
    inventory: InventoryItem[];
    suppliers: Supplier[];
    logs: InventoryLog[];
    visits?: Visit[]; // Added to see prescriptions
    onDispense?: (visit: Visit) => void; // Handler to dispense meds
    addInventoryItem: (item: InventoryItem) => void;
    updateInventoryItem: (item: InventoryItem, reason?: string) => void;
    deleteInventoryItem: (id: string) => void;
    addSupplier: (s: Supplier) => void;
    updateSupplier: (s: Supplier) => void;
    deleteSupplier: (id: string) => void;
}

type SortField = 'name' | 'stock' | 'price' | 'category' | 'expiryDate';
type SortDirection = 'asc' | 'desc';
type StockFilter = 'All' | 'Low' | 'Out' | 'Good' | 'Expiring';
type Tab = 'prescriptions' | 'inventory' | 'suppliers' | 'alerts' | 'logs' | 'invoices';

const Pharmacy: React.FC<PharmacyProps> = ({
    inventory,
    suppliers,
    logs,
    visits = [],
    onDispense,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    addSupplier,
    updateSupplier,
    deleteSupplier,
}: PharmacyProps) => {
    const [activeTab, setActiveTab] = useState<Tab>('prescriptions');

    // -- Filter & Sort State --
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('All');
    const [stockFilter, setStockFilter] = useState<StockFilter>('All');
    const [supplierFilter, setSupplierFilter] = useState<string>('All');
    const [sortConfig, setSortConfig] = useState<{ field: SortField; direction: SortDirection }>({
        field: 'name',
        direction: 'asc'
    });

    // -- Pagination State --
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    // -- Modal State --
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [selectedItemForRestock, setSelectedItemForRestock] = useState<InventoryItem | null>(null);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [selectedInvoiceVisit, setSelectedInvoiceVisit] = useState<Visit | null>(null);

    // -- Forms --
    const [restockForm, setRestockForm] = useState({ amount: '', batch: '', expiry: '' });

    const [newItemForm, setNewItemForm] = useState({
        name: '',
        category: 'Medicine',
        stock: '',
        minStockLevel: '10',
        unit: 'Tablets',
        price: '',
        batchNumber: '',
        expiryDate: '',
        supplierId: ''
    });

    const [supplierForm, setSupplierForm] = useState({
        name: '', contactPerson: '', phone: '', email: ''
    });

    // -- Helpers --
    const isExpiringSoon = (dateStr?: string) => {
        if (!dateStr) return false;
        const days = (new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
        return days <= 30 && days > 0;
    };

    const isExpired = (dateStr?: string) => {
        if (!dateStr) return false;
        return new Date(dateStr) < new Date();
    };

    // -- Derived Metrics --
    const stats = useMemo(() => {
        const totalItems = inventory.length;
        const lowStock = inventory.filter(i => i.stock <= i.minStockLevel).length;
        const outOfStock = inventory.filter(i => i.stock === 0).length;
        const totalValue = inventory.reduce((acc, item) => acc + (item.price * item.stock), 0);
        const expiring = inventory.filter(i => isExpiringSoon(i.expiryDate)).length;
        const pendingPrescriptions = visits.filter(v => v.stage === 'Pharmacy').length;
        return { totalItems, lowStock, outOfStock, totalValue, expiring, pendingPrescriptions };
    }, [inventory, visits]);

    // -- Filtering & Sorting Logic --
    const filteredAndSortedInventory = useMemo(() => {
        let data = [...inventory];

        // 1. Search
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            data = data.filter(item =>
                item.name.toLowerCase().includes(lowerTerm) ||
                item.batchNumber?.toLowerCase().includes(lowerTerm) ||
                item.id.toLowerCase().includes(lowerTerm)
            );
        }

        // 2. Filters
        if (categoryFilter !== 'All') data = data.filter(item => item.category === categoryFilter);
        if (supplierFilter !== 'All') data = data.filter(item => item.supplierId === supplierFilter);

        if (stockFilter !== 'All') {
            if (stockFilter === 'Low') data = data.filter(item => item.stock > 0 && item.stock <= item.minStockLevel);
            else if (stockFilter === 'Out') data = data.filter(item => item.stock === 0);
            else if (stockFilter === 'Good') data = data.filter(item => item.stock > item.minStockLevel);
            else if (stockFilter === 'Expiring') data = data.filter(item => isExpiringSoon(item.expiryDate) || isExpired(item.expiryDate));
        }

        // 3. Sorting
        data.sort((a, b) => {
            let aValue: any = a[sortConfig.field];
            let bValue: any = b[sortConfig.field];

            // Date handling
            if (sortConfig.field === 'expiryDate') {
                aValue = a.expiryDate ? new Date(a.expiryDate).getTime() : 9999999999999;
                bValue = b.expiryDate ? new Date(b.expiryDate).getTime() : 9999999999999;
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return data;
    }, [inventory, searchTerm, categoryFilter, stockFilter, supplierFilter, sortConfig]);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, categoryFilter, stockFilter, supplierFilter]);

    // -- Pagination Logic --
    const totalPages = Math.ceil(filteredAndSortedInventory.length / itemsPerPage);
    const paginatedItems = filteredAndSortedInventory.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // -- Handlers --

    const handleSort = (field: SortField) => {
        setSortConfig(prev => ({
            field,
            direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleItemFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setNewItemForm(prev => ({ ...prev, [name]: value }));
    };

    const openAddItemModal = () => {
        setEditingItem(null);
        setNewItemForm({
            name: '', category: 'Medicine', stock: '', minStockLevel: '10',
            unit: 'Tablets', price: '', batchNumber: '', expiryDate: '', supplierId: ''
        });
        setIsItemModalOpen(true);
    };

    const openEditItemModal = (item: InventoryItem) => {
        setEditingItem(item);
        setNewItemForm({
            name: item.name,
            category: item.category,
            stock: item.stock.toString(),
            minStockLevel: item.minStockLevel.toString(),
            unit: item.unit,
            price: item.price.toString(),
            batchNumber: item.batchNumber || '',
            expiryDate: item.expiryDate || '',
            supplierId: item.supplierId || ''
        });
        setIsItemModalOpen(true);
    };

    const openRestockModal = (item: InventoryItem) => {
        setSelectedItemForRestock(item);
        setRestockForm({ amount: '', batch: item.batchNumber || '', expiry: item.expiryDate || '' });
        setIsRestockModalOpen(true);
    };

    const openInvoiceModal = (visit: Visit) => {
        setSelectedInvoiceVisit(visit);
        setIsInvoiceModalOpen(true);
    }

    const handleRestockSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItemForRestock || !restockForm.amount) return;

        const amount = parseInt(restockForm.amount);
        if (isNaN(amount) || amount <= 0) return;

        const updatedItem: InventoryItem = {
            ...selectedItemForRestock,
            stock: selectedItemForRestock.stock + amount,
            batchNumber: restockForm.batch || selectedItemForRestock.batchNumber,
            expiryDate: restockForm.expiry || selectedItemForRestock.expiryDate
        };

        updateInventoryItem(updatedItem, `Manual Restock (+${amount})`);
        setIsRestockModalOpen(false);
        setSelectedItemForRestock(null);
    };

    const handleItemSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemForm.name) return;

        // Safety checks for numerical values
        const safeStock = Math.max(0, parseInt(newItemForm.stock) || 0);
        const safeMinStock = Math.max(0, parseInt(newItemForm.minStockLevel) || 0);
        const safePrice = Math.max(0, parseFloat(newItemForm.price) || 0);

        const newItemData: InventoryItem = {
            id: editingItem ? editingItem.id : Date.now().toString(),
            name: newItemForm.name,
            category: newItemForm.category as any,
            stock: safeStock,
            minStockLevel: safeMinStock,
            unit: newItemForm.unit,
            price: safePrice,
            batchNumber: newItemForm.batchNumber,
            expiryDate: newItemForm.expiryDate,
            supplierId: newItemForm.supplierId
        };

        if (editingItem) {
            updateInventoryItem(newItemData);
        } else {
            addInventoryItem(newItemData);
        }
        setIsItemModalOpen(false);
    };

    // -- Supplier Handlers --
    const handleSupplierSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!supplierForm.name) return;

        if (editingSupplier) {
            updateSupplier({ ...editingSupplier, ...supplierForm });
        } else {
            addSupplier({ id: `S${Date.now()}`, ...supplierForm });
        }
        setIsSupplierModalOpen(false);
    };

    const openSupplierModal = (supplier?: Supplier) => {
        if (supplier) {
            setEditingSupplier(supplier);
            setSupplierForm({ name: supplier.name, contactPerson: supplier.contactPerson, phone: supplier.phone, email: supplier.email });
        } else {
            setEditingSupplier(null);
            setSupplierForm({ name: '', contactPerson: '', phone: '', email: '' });
        }
        setIsSupplierModalOpen(true);
    };

    // -- Render Methods --

    const renderStats = () => (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-6 md:mb-8">
            <div
                onClick={() => setActiveTab('prescriptions')}
                className="bg-purple-600 text-white p-4 sm:p-5 rounded-2xl shadow-lg shadow-purple-200 dark:shadow-none flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4 cursor-pointer hover:scale-[1.02] transition-transform group relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 blur-2xl"></div>
                <div className="p-2.5 sm:p-3 bg-white/20 rounded-xl text-white relative z-10">
                    <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="relative z-10 text-center sm:text-left">
                    <div className="text-xl sm:text-2xl md:text-3xl font-bold">{stats.pendingPrescriptions}</div>
                    <div className="text-[10px] sm:text-xs md:text-sm font-medium opacity-90">Pending Orders</div>
                </div>
            </div>

            <div
                onClick={() => { setStockFilter('All'); setActiveTab('inventory'); }}
                className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4 cursor-pointer hover:border-blue-200 transition-all group"
            >
                <div className="p-2.5 sm:p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                    <Package className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="text-center sm:text-left">
                    <div className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{stats.totalItems}</div>
                    <div className="text-[10px] sm:text-xs md:text-sm text-slate-500 font-medium">Total Products</div>
                </div>
            </div>

            <div
                onClick={() => { setStockFilter('Low'); setActiveTab('inventory'); }}
                className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4 cursor-pointer hover:border-red-200 transition-all group"
            >
                <div className="p-2.5 sm:p-3 bg-red-50 dark:bg-red-900/30 rounded-xl text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform">
                    <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="text-center sm:text-left">
                    <div className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{stats.lowStock + stats.outOfStock}</div>
                    <div className="text-[10px] sm:text-xs md:text-sm text-slate-500 font-medium">Low Stock</div>
                </div>
            </div>

            <div
                onClick={() => { setStockFilter('Expiring'); setActiveTab('inventory'); }}
                className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4 cursor-pointer hover:border-orange-200 transition-all group"
            >
                <div className="p-2.5 sm:p-3 bg-orange-50 dark:bg-orange-900/30 rounded-xl text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
                    <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="text-center sm:text-left">
                    <div className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{stats.expiring}</div>
                    <div className="text-[10px] sm:text-xs md:text-sm text-slate-500 font-medium">Expiring</div>
                </div>
            </div>
        </div>
    );

    const renderPrescriptionsTab = () => {
        const pending = visits.filter(v => v.stage === 'Pharmacy');

        return (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Incoming Prescriptions ({pending.length})</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    {pending.map(visit => {
                        const isPaid = visit.paymentStatus === 'Paid';
                        return (
                            <div key={visit.id} className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="font-bold text-lg text-slate-900 dark:text-white">{visit.patientName}</h4>
                                        <p className="text-xs text-slate-500">Prescribed: {new Date(visit.startTime).toLocaleTimeString()}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full text-xs font-bold">
                                            Queue #{visit.queueNumber}
                                        </span>
                                        {isPaid ? (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded border border-green-100 dark:border-green-800">
                                                <Check className="w-3 h-3" /> PAID
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded border border-amber-100 dark:border-amber-800">
                                                <AlertCircle className="w-3 h-3" /> PENDING PAYMENT
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3 mb-6">
                                    {visit.prescription.map((item, i) => {
                                        const inStock = inventory.find(inv => inv.id === item.inventoryId)?.stock || 0;
                                        const isEnough = inStock >= item.quantity;
                                        return (
                                            <div key={i} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                                                <div>
                                                    <div className="font-bold text-slate-800 dark:text-white text-sm">{item.name}</div>
                                                    <div className="text-xs text-slate-500">{item.dosage}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-bold text-slate-900 dark:text-white">x{item.quantity}</div>
                                                    <div className={`text-[10px] font-bold ${isEnough ? 'text-green-600' : 'text-red-500'}`}>
                                                        Stock: {inStock}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {!isPaid && (
                                    <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800 flex items-center gap-3">
                                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                                        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Verify payment at the billing desk before dispensing.</p>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => window.print()}
                                        className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2 border border-slate-200"
                                    >
                                        <Printer className="w-5 h-5" /> Print
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (!canCurrentUser('pharmacy.dispense')) {
                                                try { useStore.getState().actions.showToast('You are not authorized to dispense medications.', 'error') } catch (e) { alert('You are not authorized to dispense medications.') }
                                                return
                                            }
                                            if (!isPaid) {
                                                try { useStore.getState().actions.showToast('Billing must be cleared before dispensing.', 'error') } catch (e) { alert('Billing must be cleared.') }
                                                return
                                            }
                                            onDispense && onDispense(visit)
                                        }}
                                        aria-disabled={!canCurrentUser('pharmacy.dispense') || !isPaid}
                                        disabled={!canCurrentUser('pharmacy.dispense') || !isPaid}
                                        className={`flex-[2] py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${canCurrentUser('pharmacy.dispense') && isPaid ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-lg shadow-teal-200 dark:shadow-none' : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'}`}
                                    >
                                        <CheckCircle className="w-5 h-5" /> Dispense
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {pending.length === 0 && (
                        <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">
                            <Pill className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>No pending prescriptions.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderInvoicesTab = () => {
        // Completed visits that had a prescription
        const completedVisits = visits.filter(v =>
            (v.stage === 'Clearance' || v.stage === 'Completed') && v.prescription.length > 0
        );

        return (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Generated Invoices</h3>
                    <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                        <Receipt className="w-4 h-4" /> eTIMS Compliant
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm min-w-[700px]">
                            <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs uppercase text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-700">
                                <tr>
                                    <th className="px-6 py-4">Receipt #</th>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Patient</th>
                                    <th className="px-6 py-4">Items</th>
                                    <th className="px-6 py-4">Total Amount</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {completedVisits.map(visit => {
                                    const total = visit.totalBill; // Using the billed total
                                    return (
                                        <tr key={visit.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="px-6 py-4 font-mono text-xs text-slate-500">
                                                {visit.id.replace('V', 'INV-')}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {new Date(visit.startTime).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                                                {visit.patientName}
                                            </td>
                                            <td className="px-6 py-4">
                                                {visit.prescription.length} Meds
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                                                KSh {total.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => openInvoiceModal(visit)}
                                                    className="text-teal-600 hover:text-teal-800 dark:text-teal-400 font-bold text-xs flex items-center justify-end gap-1"
                                                >
                                                    <Receipt className="w-3 h-3" /> View Receipt
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {completedVisits.length === 0 && (
                                    <tr><td colSpan={6} className="p-8 text-center text-slate-400">No invoices generated yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    const renderInventoryTab = () => (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Toolbar */}
            <div className="bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 mb-6 flex flex-col lg:flex-row gap-3 sm:gap-4 items-center justify-between">
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                    {/* Search */}
                    <div className="relative w-full lg:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 dark:text-white rounded-xl text-sm w-full outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                        />
                    </div>

                    {/* Filters */}
                    <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                        <select
                            className="flex-1 sm:flex-none appearance-none bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer min-w-[120px]"
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                            <option value="All">All Categories</option>
                            <option value="Medicine">Medicine</option>
                            <option value="Supply">Supply</option>
                            <option value="Lab">Lab</option>
                        </select>

                        <select
                            className="flex-1 sm:flex-none appearance-none bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer min-w-[120px]"
                            value={stockFilter}
                            onChange={(e) => setStockFilter(e.target.value as StockFilter)}
                        >
                            <option value="All">All Status</option>
                            <option value="Good">In Stock</option>
                            <option value="Low">Low</option>
                            <option value="Out">Out</option>
                            <option value="Expiring">Expiring</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button onClick={openAddItemModal} className="flex-1 sm:flex-none bg-teal-600 text-white flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl hover:bg-teal-700 shadow-lg shadow-teal-200 dark:shadow-none font-bold transition-all active:scale-95 text-sm">
                        <Plus className="w-5 h-5" /> <span>Add Item</span>
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden transition-colors flex flex-col min-h-[400px]">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs uppercase text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-700">
                            <tr>
                                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group" onClick={() => handleSort('name')}>
                                    <div className="flex items-center gap-2">Item Name <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100" /></div>
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group" onClick={() => handleSort('category')}>
                                    <div className="flex items-center gap-2">Category <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100" /></div>
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group" onClick={() => handleSort('stock')}>
                                    <div className="flex items-center gap-2">Stock Level <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100" /></div>
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group" onClick={() => handleSort('expiryDate')}>
                                    <div className="flex items-center gap-2">Expiry <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100" /></div>
                                </th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700 text-sm">
                            {paginatedItems.map((item) => {
                                const expiring = isExpiringSoon(item.expiryDate);
                                const expired = isExpired(item.expiryDate);
                                return (
                                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-900 dark:text-white">{item.name}</div>
                                            <div className="text-xs text-slate-400 flex items-center gap-2">
                                                <span>{item.unit}</span>
                                                {item.batchNumber && <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px] font-mono">Batch: {item.batchNumber}</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${item.category === 'Medicine' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900' :
                                                item.category === 'Supply' ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-100 dark:border-orange-900' :
                                                    'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-900'
                                                }`}>
                                                {item.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden w-24">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${item.stock === 0 ? 'bg-slate-300' : item.stock <= item.minStockLevel ? 'bg-red-500' : 'bg-emerald-500'}`}
                                                        style={{ width: `${Math.min((item.stock / (item.minStockLevel * 3)) * 100, 100)}%` }}
                                                    ></div>
                                                </div>
                                                <span className={`text-xs font-bold ${item.stock <= item.minStockLevel ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                                    {item.stock}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {item.expiryDate ? (
                                                <div className={`flex items-center gap-1.5 ${expired ? 'text-red-600 font-bold' : expiring ? 'text-orange-600 font-bold' : 'text-slate-600 dark:text-slate-400'}`}>
                                                    {(expired || expiring) && <AlertTriangle className="w-3.5 h-3.5" />}
                                                    {item.expiryDate}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 italic">--</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {item.stock === 0 ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold border border-slate-200 dark:border-slate-600">
                                                    <X className="w-3 h-3" /> Out
                                                </span>
                                            ) : item.stock <= item.minStockLevel ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold border border-red-100 dark:border-red-900">
                                                    <AlertTriangle className="w-3 h-3" /> Low
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-100 dark:border-emerald-900">
                                                    <Check className="w-3 h-3" /> Good
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => { setSearchTerm(item.name); setActiveTab('logs'); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors" title="Audit Log">
                                                    <ClipboardList className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => openRestockModal(item)} className="p-2 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg text-teal-600 dark:text-teal-400 transition-colors" title="Restock">
                                                    <RefreshCw className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => openEditItemModal(item)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors" title="Edit">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (!canCurrentUser('inventory.delete')) { try { useStore.getState().actions.showToast('Not authorized to delete inventory items.', 'error') } catch (e) { alert('Not authorized to delete inventory items.') } return }
                                                        deleteInventoryItem(item.id)
                                                    }}
                                                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-red-500 transition-colors"
                                                    title="Delete"
                                                    disabled={!canCurrentUser('inventory.delete')}
                                                    aria-disabled={!canCurrentUser('inventory.delete')}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {paginatedItems.length === 0 && (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">No items found matching your filters.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                        <div className="text-sm text-slate-500 dark:text-slate-400">Showing page {currentPage} of {totalPages}</div>
                        <div className="flex gap-2">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-600 dark:text-slate-300">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-600 dark:text-slate-300">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const renderSuppliersTab = () => (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Supplier Management</h3>
                <button onClick={() => openSupplierModal()} className="w-full sm:w-auto bg-teal-600 text-white flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl hover:bg-teal-700 font-bold transition-colors">
                    <Plus className="w-5 h-5" /> Add Supplier
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {suppliers.map(supplier => {
                    const itemsSupplied = inventory.filter(i => i.supplierId === supplier.id).length;
                    return (
                        <div key={supplier.id} className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow group relative">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                                    <Truck className="w-6 h-6" />
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openSupplierModal(supplier)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => { if (!canCurrentUser('inventory.delete')) { try { useStore.getState().actions.showToast('Not authorized to delete suppliers.', 'error') } catch (e) { alert('Not authorized to delete suppliers.') } return } deleteSupplier(supplier.id) }}
                                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400 hover:text-red-500 transition-colors"
                                        disabled={!canCurrentUser('inventory.delete')}
                                        aria-disabled={!canCurrentUser('inventory.delete')}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{supplier.name}</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{itemsSupplied} Products Supplied</p>

                            <div className="space-y-2 border-t border-slate-100 dark:border-slate-700 pt-4">
                                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                    <Briefcase className="w-4 h-4 text-slate-400" /> {supplier.contactPerson}
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                    <Phone className="w-4 h-4 text-slate-400" /> {supplier.phone}
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                    <Mail className="w-4 h-4 text-slate-400" /> {supplier.email}
                                </div>
                            </div>
                        </div>
                    )
                })}
                {suppliers.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">
                        <Truck className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No suppliers added yet.</p>
                    </div>
                )}
            </div>
        </div>
    );

    const renderLogsTab = () => {
        const filteredLogs = searchTerm
            ? logs.filter(l => l.itemName.toLowerCase().includes(searchTerm.toLowerCase()))
            : logs;

        return (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Inventory Audit Trail</h3>
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="text-sm text-teal-600 font-bold hover:underline flex items-center gap-1">
                            <X className="w-4 h-4" /> Clear Filter: "{searchTerm}"
                        </button>
                    )}
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[800px]">
                            <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs uppercase text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-700">
                                <tr>
                                    <th className="px-6 py-4">Timestamp</th>
                                    <th className="px-6 py-4">Item</th>
                                    <th className="px-6 py-4">Action</th>
                                    <th className="px-6 py-4">Change</th>
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Notes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-700 text-sm">
                                {filteredLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                            {log.itemName}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${log.action === 'Restocked' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                                log.action === 'Dispensed' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                                                    log.action === 'Deleted' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                                        'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                                }`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs">
                                            {log.quantityChange && log.quantityChange > 0 ? `+${log.quantityChange}` : log.quantityChange || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{log.user}</td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 italic max-w-xs truncate">{log.notes}</td>
                                    </tr>
                                ))}
                                {filteredLogs.length === 0 && (
                                    <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">No logs found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderAlertsTab = () => {
        const problems = inventory.filter(item =>
            item.stock <= item.minStockLevel || isExpiringSoon(item.expiryDate) || isExpired(item.expiryDate)
        );

        return (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Action Required ({problems.length})</h3>

                <div className="space-y-4">
                    {problems.map(item => {
                        const expired = isExpired(item.expiryDate);
                        const low = item.stock <= item.minStockLevel;
                        return (
                            <div key={item.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl shrink-0 ${expired ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                        <AlertCircle className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white">{item.name}</h4>
                                        <div className="flex flex-wrap gap-x-2 gap-y-1 text-sm text-slate-500 mt-1">
                                            {low && <span className="text-red-500 font-bold whitespace-nowrap">Low Stock: {item.stock} / {item.minStockLevel}</span>}
                                            {low && expired && <span className="hidden sm:inline">•</span>}
                                            {expired && <span className="text-red-500 font-bold whitespace-nowrap">Expired: {item.expiryDate}</span>}
                                            {!expired && isExpiringSoon(item.expiryDate) && <span className="text-orange-500 font-bold whitespace-nowrap">Expiring: {item.expiryDate}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <button
                                        onClick={() => { if (!canCurrentUser('inventory.delete')) { try { useStore.getState().actions.showToast('Not authorized to delete inventory items.', 'error') } catch (e) { alert('Not authorized to delete inventory items.') } return } deleteInventoryItem(item.id) }}
                                        className="flex-1 sm:flex-none px-4 py-2 text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 rounded-xl font-bold text-sm transition-colors"
                                        disabled={!canCurrentUser('inventory.delete')}
                                        aria-disabled={!canCurrentUser('inventory.delete')}
                                    >
                                        Discard
                                    </button>
                                    <button onClick={() => openRestockModal(item)} className="flex-1 sm:flex-none px-4 py-2 bg-teal-600 text-white hover:bg-teal-700 rounded-xl font-bold text-sm transition-colors">
                                        Restock
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {problems.length === 0 && (
                        <div className="py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl bg-slate-50 dark:bg-slate-800/50">
                            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
                            <p className="font-bold text-slate-700 dark:text-slate-300">All systems good!</p>
                            <p className="text-sm">No low stock or expiring items.</p>
                        </div>
                    )}
                </div>
            </div>
        )
    };

    return (
        <div className="p-4 sm:p-6 md:p-10 bg-gray-50 dark:bg-slate-900 min-h-screen transition-colors duration-200 relative pb-24">
            {/* Header */}
            <div className="flex flex-col mb-6 sm:mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Pharmacy & Inventory</h2>
                <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-1">Dispense prescriptions and manage stock.</p>
            </div>

            {/* Stats */}
            {renderStats()}

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 mb-8 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl w-fit overflow-x-auto max-w-full">
                {[
                    { id: 'prescriptions', label: 'Prescriptions', icon: ClipboardList },
                    { id: 'invoices', label: 'eTIMS Invoices', icon: Receipt },
                    { id: 'inventory', label: 'Inventory List', icon: Package },
                    { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
                    { id: 'suppliers', label: 'Suppliers', icon: Truck },
                    { id: 'logs', label: 'Audit Log', icon: History }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as Tab)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                        {tab.id === 'alerts' && stats.lowStock + stats.expiring > 0 && (
                            <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{stats.lowStock + stats.expiring}</span>
                        )}
                        {tab.id === 'prescriptions' && stats.pendingPrescriptions > 0 && (
                            <span className="ml-1 bg-purple-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{stats.pendingPrescriptions}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            {activeTab === 'prescriptions' && renderPrescriptionsTab()}
            {activeTab === 'invoices' && renderInvoicesTab()}
            {activeTab === 'inventory' && renderInventoryTab()}
            {activeTab === 'suppliers' && renderSuppliersTab()}
            {activeTab === 'logs' && renderLogsTab()}
            {activeTab === 'alerts' && renderAlertsTab()}

            {/* Modals */}

            {/* Invoice Generation Modal */}
            {isInvoiceModalOpen && selectedInvoiceVisit && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
                    <div className="bg-white w-full max-w-sm rounded-none shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                        {/* Thermal Receipt Header */}
                        <div className="p-6 pb-2 text-center bg-white text-slate-900 border-b-2 border-dashed border-slate-300">
                            <h2 className="text-xl font-bold uppercase tracking-wide">JuaAfya Clinic</h2>
                            <p className="text-xs font-mono mt-1">P.O. Box 12345-00100, Nairobi</p>
                            <p className="text-xs font-mono">Tel: +254 712 345 678</p>
                            <p className="text-xs font-mono mt-2">PIN: P051234567Z</p>
                            <p className="text-xs font-mono">CU Serial: KRAMW0023881</p>
                        </div>

                        {/* Receipt Body */}
                        <div className="p-6 py-4 flex-1 overflow-y-auto bg-white font-mono text-sm text-slate-800">
                            <div className="flex justify-between mb-4 border-b border-slate-200 pb-2">
                                <span>Date: {new Date(selectedInvoiceVisit.startTime).toLocaleDateString()}</span>
                                <span>Time: {new Date(selectedInvoiceVisit.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="mb-4">
                                <p className="font-bold">Patient: {selectedInvoiceVisit.patientName}</p>
                                <p className="text-xs">Receipt #: {selectedInvoiceVisit.id.replace('V', 'INV')}</p>
                            </div>

                            <table className="w-full text-xs mb-4">
                                <thead>
                                    <tr className="border-b border-black">
                                        <th className="text-left py-1">Item</th>
                                        <th className="text-right py-1">Qty</th>
                                        <th className="text-right py-1">Price</th>
                                        <th className="text-right py-1">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Consultation */}
                                    <tr>
                                        <td className="py-1">Consultation</td>
                                        <td className="text-right">1</td>
                                        <td className="text-right">{selectedInvoiceVisit.consultationFee}</td>
                                        <td className="text-right">{selectedInvoiceVisit.consultationFee.toFixed(2)}</td>
                                    </tr>
                                    {/* Labs */}
                                    {selectedInvoiceVisit.labOrders.map((lab, i) => (
                                        <tr key={`lab-${i}`}>
                                            <td className="py-1">{lab.testName}</td>
                                            <td className="text-right">1</td>
                                            <td className="text-right">{lab.price}</td>
                                            <td className="text-right">{lab.price.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {/* Meds */}
                                    {selectedInvoiceVisit.prescription.map((med, i) => (
                                        <tr key={`med-${i}`}>
                                            <td className="py-1">{med.name}</td>
                                            <td className="text-right">{med.quantity}</td>
                                            <td className="text-right">{med.price}</td>
                                            <td className="text-right">{(med.price * med.quantity).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="border-t-2 border-dashed border-slate-300 pt-2 space-y-1">
                                <div className="flex justify-between">
                                    <span>TOTAL AMOUNT:</span>
                                    <span className="font-bold">KSh {selectedInvoiceVisit.totalBill.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span>Cash / M-Pesa:</span>
                                    <span>{selectedInvoiceVisit.totalBill.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="mt-4 pt-2 border-t border-slate-200">
                                <div className="flex justify-between text-xs">
                                    <span>Taxable Amount (Net):</span>
                                    <span>{((selectedInvoiceVisit.totalBill / 1.16)).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span>VAT (16%):</span>
                                    <span>{((selectedInvoiceVisit.totalBill / 1.16) * 0.16).toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="mt-6 text-center">
                                <div className="w-24 h-24 bg-slate-900 mx-auto mb-2 flex items-center justify-center text-white">
                                    <QrCode className="w-16 h-16" />
                                </div>
                                <p className="text-[10px] uppercase">Scannable by KRA iTax</p>
                                <p className="text-xs font-bold mt-2">*** END OF FISCAL RECEIPT ***</p>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 bg-slate-100 flex gap-2">
                            <button
                                onClick={() => setIsInvoiceModalOpen(false)}
                                className="flex-1 py-2 bg-white border border-slate-300 text-slate-700 font-bold uppercase text-xs rounded hover:bg-slate-50"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="flex-1 py-2 bg-slate-900 text-white font-bold uppercase text-xs rounded hover:bg-slate-800 flex items-center justify-center gap-2"
                            >
                                <Printer className="w-4 h-4" /> Print
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Item Modal */}
            {isItemModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-700/50">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                {editingItem ? <Edit2 className="w-5 h-5 text-teal-600" /> : <Plus className="w-5 h-5 text-teal-600" />}
                                {editingItem ? 'Edit Product' : 'Add New Product'}
                            </h3>
                            <button onClick={() => setIsItemModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><X className="w-6 h-6" /></button>
                        </div>

                        <form onSubmit={handleItemSubmit} className="p-6 space-y-5 overflow-y-auto">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div className="sm:col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Product Name</label>
                                    <input name="name" value={newItemForm.name} onChange={handleItemFormChange} placeholder="e.g. Paracetamol 500mg" className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none dark:text-white font-medium" required />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Category</label>
                                    <select name="category" value={newItemForm.category} onChange={handleItemFormChange} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none dark:text-white font-medium">
                                        <option value="Medicine">Medicine</option>
                                        <option value="Supply">Supply</option>
                                        <option value="Lab">Lab</option>
                                        <option value="Equipment">Equipment</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Unit Type</label>
                                    <input name="unit" value={newItemForm.unit} onChange={handleItemFormChange} placeholder="e.g. Tablets" className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none dark:text-white font-medium" required />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Current Stock</label>
                                    <input type="number" name="stock" value={newItemForm.stock} onChange={handleItemFormChange} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none dark:text-white font-bold" required />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Min Stock Level (Alert)</label>
                                    <input type="number" name="minStockLevel" value={newItemForm.minStockLevel} onChange={handleItemFormChange} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none dark:text-white font-medium" required />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Unit Price (KSh)</label>
                                    <input type="number" name="price" value={newItemForm.price} onChange={handleItemFormChange} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none dark:text-white font-medium" required />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Supplier</label>
                                    <select name="supplierId" value={newItemForm.supplierId} onChange={handleItemFormChange} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none dark:text-white font-medium">
                                        <option value="">-- Select Supplier --</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>

                                <div className="sm:col-span-2 border-t border-slate-100 dark:border-slate-700 pt-4 mt-2">
                                    <h4 className="font-bold text-slate-900 dark:text-white mb-3 text-sm flex items-center gap-2"><Tag className="w-4 h-4" /> Batch Tracking (Optional)</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Batch Number</label>
                                            <input name="batchNumber" value={newItemForm.batchNumber} onChange={handleItemFormChange} placeholder="e.g. B-102" className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none dark:text-white font-medium" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Expiry Date</label>
                                            <input type="date" name="expiryDate" value={newItemForm.expiryDate} onChange={handleItemFormChange} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none dark:text-white font-medium" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsItemModalOpen(false)} className="flex-1 py-3 text-slate-600 dark:text-slate-300 font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors">Cancel</button>
                                <button type="submit" className="flex-1 py-3 text-white font-bold bg-teal-600 hover:bg-teal-700 rounded-xl shadow-lg shadow-teal-200 dark:shadow-none transition-colors flex items-center justify-center gap-2">
                                    <Check className="w-5 h-5" /> {editingItem ? 'Save Changes' : 'Create Product'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Restock Modal */}
            {isRestockModalOpen && selectedItemForRestock && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <RefreshCw className="w-5 h-5 text-teal-600" /> Restock Item
                            </h3>
                            <button onClick={() => setIsRestockModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleRestockSubmit} className="p-5 sm:p-6">
                            <div className="mb-5 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Product</p>
                                <p className="font-bold text-slate-900 dark:text-white mb-2">{selectedItemForRestock.name}</p>
                                <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-100 dark:border-slate-700/50">
                                    <span className="text-slate-500 font-medium">Current Stock</span>
                                    <span className="font-bold text-teal-600 dark:text-teal-400">{selectedItemForRestock.stock} {selectedItemForRestock.unit}</span>
                                </div>
                            </div>

                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5">Quantity to Add</label>
                                    <input type="number" min="1" autoFocus value={restockForm.amount} onChange={(e) => setRestockForm({ ...restockForm, amount: e.target.value })} className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl font-bold outline-none dark:text-white focus:ring-2 focus:ring-teal-500" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5">New Batch #</label>
                                        <input value={restockForm.batch} onChange={(e) => setRestockForm({ ...restockForm, batch: e.target.value })} className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none dark:text-white focus:ring-2 focus:ring-teal-500" placeholder="Optional" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5">New Expiry</label>
                                        <input type="date" value={restockForm.expiry} onChange={(e) => setRestockForm({ ...restockForm, expiry: e.target.value })} className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none dark:text-white focus:ring-2 focus:ring-teal-500" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button type="button" onClick={() => setIsRestockModalOpen(false)} className="flex-1 py-3 text-slate-600 dark:text-slate-300 font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors">Cancel</button>
                                <button type="submit" disabled={!restockForm.amount} className="flex-1 py-3 text-white font-bold bg-teal-600 hover:bg-teal-700 rounded-xl shadow-lg shadow-teal-500/20 transition-all active:scale-[0.98] disabled:opacity-50">Confirm</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Supplier Modal */}
            {isSupplierModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Truck className="w-5 h-5 text-teal-600" /> {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
                            </h3>
                            <button onClick={() => setIsSupplierModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSupplierSubmit} className="p-5 sm:p-6 space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5">Company Name</label>
                                <input value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none dark:text-white font-medium focus:ring-2 focus:ring-teal-500" required />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5">Contact Person</label>
                                    <input value={supplierForm.contactPerson} onChange={e => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none dark:text-white font-medium focus:ring-2 focus:ring-teal-500" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5">Phone Number</label>
                                    <input value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none dark:text-white font-medium focus:ring-2 focus:ring-teal-500" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5">Email Address</label>
                                    <input value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none dark:text-white font-medium focus:ring-2 focus:ring-teal-500" />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setIsSupplierModalOpen(false)} className="flex-1 py-3 text-slate-600 dark:text-slate-300 font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors">Cancel</button>
                                <button type="submit" className="flex-1 py-3 text-white font-bold bg-teal-600 hover:bg-teal-700 rounded-xl shadow-lg shadow-teal-500/20 transition-all active:scale-[0.98]">Save Supplier</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Pharmacy;

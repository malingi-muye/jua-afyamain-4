import React, { useState, useMemo } from 'react';
import { Patient, Gender, ClinicSettings } from '../types';
import { Search, Plus, Phone, FileText, Sparkles, X, Activity, MessageSquare, MoreHorizontal, Printer, Filter, Edit2, Save, User, Trash2, Send, Loader2, Eye, ChevronLeft, ChevronRight, Check, Upload, Download } from 'lucide-react';
import { exportService } from '../services/exportService';
import { analyzePatientNotes, draftAppointmentSms } from '../services/geminiService';
import { sendSMS } from '../services/smsService';
import BulkImportPatients from './BulkImportPatients';
import useStore from '../store'
import { hasPermission } from '../lib/permissions'
import { canCurrentUser } from '../lib/roleMapper'
import type { UserRole } from '../types/enterprise'
import { getAvatarUrl } from '../lib/utils'

interface PatientListProps {
    patients: Patient[];
    addPatient: (p: Patient) => void;
    updatePatient: (p: Patient) => void;
    deletePatient: (id: string) => void;
    settings?: ClinicSettings;
}

const PatientList: React.FC<PatientListProps> = ({ patients, addPatient, updatePatient, deletePatient, settings }) => {
    const { currentUser, actions } = useStore()

    const canDelete = canCurrentUser('patients.delete')
    const canExport = canCurrentUser('patients.export')
    const canCreate = canCurrentUser('patients.create')
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    // Action Menu State
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

    // Add Patient State
    const [isAdding, setIsAdding] = useState(false);
    const [showBulkImport, setShowBulkImport] = useState(false);
    const [newPatientData, setNewPatientData] = useState({
        name: '',
        phone: '',
        age: '',
        gender: Gender.Male,
        notes: '',
        allergies: '',
        history: '',
        bloodGroup: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        emergencyContactRel: '',
        vitals: { bp: '', heartRate: '', temp: '', weight: '' }
    });

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editFormData, setEditFormData] = useState({
        id: '',
        name: '',
        phone: '',
        age: '',
        gender: Gender.Male,
        notes: '',
        allergies: '',
        bloodGroup: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        emergencyContactRel: '',
        vitals: { bp: '', heartRate: '', temp: '', weight: '' },
        history: [] as string[],
        lastVisit: ''
    });

    // Vitals Inline Edit State
    const [isEditingVitals, setIsEditingVitals] = useState(false);
    const [tempVitals, setTempVitals] = useState({ bp: '', heartRate: '', temp: '', weight: '' });

    // History State
    const [isAddingHistory, setIsAddingHistory] = useState(false);
    const [newHistoryNote, setNewHistoryNote] = useState('');

    // Filtering & Sorting State
    const [genderFilter, setGenderFilter] = useState<string>('All');
    const [minAge, setMinAge] = useState<string>('');
    const [maxAge, setMaxAge] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [sortBy, setSortBy] = useState<string>('Recent'); // Recent, Name, Age

    // AI State
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

    // SMS State
    const [showSmsModal, setShowSmsModal] = useState(false);
    const [draftingSms, setDraftingSms] = useState(false);
    const [sendingSms, setSendingSms] = useState(false);
    const [smsDraft, setSmsDraft] = useState('');

    // Enhanced Filter Logic
    const isPatientActive = (p: Patient) => {
        if (!p.lastVisit) return false;
        const daysSince = (Date.now() - new Date(p.lastVisit).getTime()) / (1000 * 60 * 60 * 24);
        return daysSince <= 365; // Active if seen within last year
    };

    const filtered = useMemo(() => patients
        .filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.phone.includes(searchTerm) || p.id.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesGender = genderFilter === 'All' || p.gender === genderFilter;

            const min = minAge ? Number(minAge) : undefined;
            const max = maxAge ? Number(maxAge) : undefined;
            const matchesAge = (!min || p.age >= min) && (!max || p.age <= max);

            const matchesStatus = statusFilter === 'All' || (statusFilter === 'Active' ? isPatientActive(p) : !isPatientActive(p));

            return matchesSearch && matchesGender && matchesAge && matchesStatus;
        })
        .sort((a, b) => {
            if (sortBy === 'Name') return a.name.localeCompare(b.name);
            if (sortBy === 'Age') return a.age - b.age;
            // Default to Recent
            return new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime();
        }), [patients, searchTerm, genderFilter, sortBy, minAge, maxAge, statusFilter]);

    // Pagination Logic
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginatedPatients = filtered.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleAnalyzeNotes = async (notes: string) => {
        setIsAnalyzing(true);
        setAiAnalysis(null);
        const result = await analyzePatientNotes(notes);
        setAiAnalysis(result);
        setIsAnalyzing(false);
    };

    const handleDraftSms = async (patient: Patient) => {
        setShowSmsModal(true);
        setDraftingSms(true);
        // Determine last visit or next likely follow up based on notes (simulated logic for demo)
        const reason = "Follow-up checkup";
        const date = "next Tuesday";
        const draft = await draftAppointmentSms(patient.name, date, reason);
        setSmsDraft(draft);
        setDraftingSms(false);
    };

    const handleConfirmSendSms = async () => {
        if (!selectedPatient || !smsDraft) return;

        setSendingSms(true);
        try {
            const result = await sendSMS({
                phone_number: selectedPatient.phone,
                message: smsDraft
            });

            if (result.success) {
                alert(`SMS sent successfully to ${selectedPatient.name}!`);
                setShowSmsModal(false);
                setSmsDraft('');
            } else {
                alert('Failed to send SMS: ' + (result.error || result.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error sending SMS:', error);
            alert('Error sending SMS: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setSendingSms(false);
        }
    };

    const handleEditClick = (patient: Patient) => {
        setEditFormData({
            id: patient.id,
            name: patient.name,
            phone: patient.phone,
            age: String(patient.age),
            gender: patient.gender,
            notes: patient.notes,
            allergies: patient.allergies?.join(', ') || '',
            bloodGroup: patient.bloodGroup || '',
            emergencyContactName: patient.emergencyContact?.name || '',
            emergencyContactPhone: patient.emergencyContact?.phone || '',
            emergencyContactRel: patient.emergencyContact?.relationship || '',
            vitals: {
                bp: patient.vitals?.bp || '',
                heartRate: patient.vitals?.heartRate || '',
                temp: patient.vitals?.temp || '',
                weight: patient.vitals?.weight || ''
            },
            history: patient.history || [],
            lastVisit: patient.lastVisit
        });
        setIsEditing(true);
        setActiveMenuId(null);
    };

    const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        if (editFormData) {
            setEditFormData({
                ...editFormData,
                [e.target.name]: e.target.value
            });
        }
    };

    const handleEditVitalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (editFormData) {
            setEditFormData({
                ...editFormData,
                vitals: {
                    ...(editFormData.vitals || { bp: '', heartRate: '', temp: '', weight: '' }),
                    [e.target.name]: e.target.value
                }
            });
        }
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const updatedPatient: Patient = {
            id: editFormData.id,
            name: editFormData.name,
            phone: editFormData.phone,
            age: Number(editFormData.age),
            gender: editFormData.gender as Gender,
            lastVisit: editFormData.lastVisit,
            notes: editFormData.notes,
            history: editFormData.history,
            allergies: editFormData.allergies.split(',').map(s => s.trim()).filter(s => s),
            bloodGroup: editFormData.bloodGroup,
            emergencyContact: {
                name: editFormData.emergencyContactName,
                phone: editFormData.emergencyContactPhone,
                relationship: editFormData.emergencyContactRel
            },
            vitals: editFormData.vitals
        };
        updatePatient(updatedPatient);
        setSelectedPatient(updatedPatient); // Update the view immediately
        setIsEditing(false);
    };

    const handleDelete = (id?: string) => {
        const targetId = id || editFormData?.id;
        if (!canDelete) {
            useStore.getState().actions.showToast('You do not have permission to delete patients.', 'error')
            return
        }

        if (targetId && confirm(`Are you sure you want to delete this patient record? This action cannot be undone.`)) {
            deletePatient(targetId);
            setIsEditing(false);
            setSelectedPatient(null);
            setActiveMenuId(null);
        }
    };

    const handleAddHistory = (patient: Patient) => {
        if (!newHistoryNote.trim()) return;

        const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const entry = `${newHistoryNote} (${dateStr})`;

        const updatedPatient = {
            ...patient,
            history: [entry, ...patient.history]
        };

        updatePatient(updatedPatient);
        setSelectedPatient(updatedPatient); // Update local view
        setNewHistoryNote('');
        setIsAddingHistory(false);
    };

    // Add Patient Logic
    const handleAddChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setNewPatientData({
            ...newPatientData,
            [e.target.name]: e.target.value
        });
    };

    const handleAddVitalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewPatientData({
            ...newPatientData,
            vitals: {
                ...newPatientData.vitals,
                [e.target.name]: e.target.value
            }
        });
    };

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPatientData.name || !newPatientData.age) return;

        const newPatient: Patient = {
            id: `P${Math.floor(Math.random() * 9000 + 1000)}`, // Simple ID generation
            name: newPatientData.name,
            phone: newPatientData.phone,
            age: Number(newPatientData.age),
            gender: newPatientData.gender as Gender,
            lastVisit: new Date().toISOString().split('T')[0],
            notes: newPatientData.notes,
            history: newPatientData.history ? [newPatientData.history] : [],
            allergies: newPatientData.allergies.split(',').map(s => s.trim()).filter(s => s),
            bloodGroup: newPatientData.bloodGroup,
            emergencyContact: {
                name: newPatientData.emergencyContactName,
                phone: newPatientData.emergencyContactPhone,
                relationship: newPatientData.emergencyContactRel
            },
            vitals: newPatientData.vitals
        };

        addPatient(newPatient);
        setIsAdding(false);
        setNewPatientData({
            name: '', phone: '', age: '', gender: Gender.Male, notes: '',
            allergies: '', history: '', bloodGroup: '',
            emergencyContactName: '', emergencyContactPhone: '', emergencyContactRel: '',
            vitals: { bp: '', heartRate: '', temp: '', weight: '' }
        });
    };

    const handleBulkImport = async (importedPatients: Patient[]) => {
        // Add each patient individually to maintain consistency
        // Add a small delay between additions to ensure proper state updates
        for (const patient of importedPatients) {
            addPatient(patient);
            // Small delay to allow state updates
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleCall = (phone: string) => {
        window.location.href = `tel:${phone}`;
    };

    // Export all patients (server-side service)
    const handleExportAll = async () => {
        try {
            const blob = await exportService.exportPatients({ format: 'csv' });
            const url = window.URL.createObjectURL(blob as Blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `patients_export_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export failed', err);
            alert('Failed to export patients: ' + (err instanceof Error ? err.message : 'Unknown'));
        }
    };

    // Export a single patient to CSV (client-side)
    const handleExportPatient = (patient: Patient) => {
        try {
            const columns = ['id', 'name', 'phone', 'age', 'gender', 'lastVisit', 'notes', 'allergies', 'chronicConditions', 'bloodGroup', 'emergencyContact', 'vitals'];
            const row = columns.map(col => {
                const val: any = (patient as any)[col];
                if (val === undefined || val === null) return '';
                if (typeof val === 'object') return JSON.stringify(val);
                return String(val).replace(/"/g, '""');
            }).map(v => `"${v}"`).join(',');

            const csv = [columns.join(','), row].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${patient.id}_patient_${patient.name.replace(/\s+/g, '_')}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export patient failed', err);
            alert('Failed to export patient');
        }
    };

    // Close menus when clicking outside
    React.useEffect(() => {
        const handleClickOutside = () => setActiveMenuId(null);
        if (activeMenuId) document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [activeMenuId]);

    const renderPatientDetail = (patient: Patient) => (
        <div className="fixed inset-0 z-50 flex justify-center items-center p-0 md:p-6 no-print">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => { setSelectedPatient(null); setIsEditingVitals(false); }} />

            <div className="bg-white dark:bg-slate-800 w-full md:max-w-4xl h-full md:h-auto md:max-h-[90vh] md:rounded-3xl shadow-2xl overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 p-4 sm:p-6 flex items-start justify-between">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full overflow-hidden border-2 border-slate-100 dark:border-slate-700 bg-slate-100 dark:bg-slate-700 shrink-0">
                            <img src={getAvatarUrl(patient.name)} alt="Avatar" className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2 truncate">
                                {patient.name}
                                <span className="hidden sm:inline text-sm font-normal text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">{patient.id}</span>
                            </h2>
                            <div className="flex flex-wrap items-center text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium mt-0.5 sm:mt-1 gap-x-3 gap-y-1">
                                <span>{patient.gender}</span>
                                <span className="hidden sm:block w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                                <span>{patient.age} Years</span>
                                <span className="hidden sm:block w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                                <span className="truncate">{patient.phone}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <button
                            onClick={() => handleEditClick(patient)}
                            className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500 dark:text-slate-400"
                            title="Edit Patient"
                        >
                            <Edit2 className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                        </button>
                        <button onClick={() => { setSelectedPatient(null); setAiAnalysis(null); setIsEditingVitals(false); }} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-full transition-colors">
                            <X className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 p-6 md:p-8 space-y-8 bg-gray-50/50 dark:bg-slate-900/50">
                    {/* Quick Actions Row */}
                    <div className="flex gap-2.5 sm:gap-4 overflow-x-auto pb-2 scrollbar-hide">
                        <button
                            onClick={() => handleDraftSms(patient)}
                            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 rounded-xl font-bold text-[11px] sm:text-xs hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors whitespace-nowrap shadow-sm"
                        >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Draft AI Reminder
                        </button>
                        <button
                            onClick={() => handleEditClick(patient)}
                            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-200 rounded-xl font-bold text-[11px] sm:text-xs hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors whitespace-nowrap shadow-sm"
                        >
                            <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                            onClick={() => handleCall(patient.phone)}
                            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-200 rounded-xl font-bold text-[11px] sm:text-xs hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors whitespace-nowrap shadow-sm"
                        >
                            <Phone className="w-3.5 h-3.5" /> Call
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-200 rounded-xl font-bold text-[11px] sm:text-xs hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors whitespace-nowrap shadow-sm"
                        >
                            <Printer className="w-3.5 h-3.5" /> Export
                        </button>
                        <button
                            onClick={() => {
                                if (!canDelete) {
                                    actions.showToast('You do not have permission to delete patients.', 'error')
                                    return
                                }
                                handleDelete(patient.id)
                            }}
                            disabled={!canDelete}
                            className={`flex items-center gap-2 px-3 sm:px-4 py-2 ${canDelete ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border-red-200 dark:border-red-900/30 shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed'} border rounded-xl font-bold text-[11px] sm:text-xs transition-colors whitespace-nowrap`}
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                    </div>

                    {/* SMS Modal */}
                    {showSmsModal && (
                        <div className="bg-white dark:bg-slate-800 border border-brand-100 dark:border-slate-600 rounded-2xl p-4 shadow-xl animate-in slide-in-from-top-2">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold text-brand-800 dark:text-brand-300 flex items-center gap-2 text-sm">
                                    <Sparkles className="w-4 h-4" /> AI Generated SMS Draft
                                </h4>
                                <button onClick={() => setShowSmsModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                            </div>
                            {draftingSms ? (
                                <div className="py-4 flex items-center justify-center text-slate-400 text-sm">
                                    <Activity className="w-4 h-4 animate-spin mr-2" /> Drafting message...
                                </div>
                            ) : (
                                <textarea
                                    className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg text-slate-700 dark:text-slate-200 text-sm border border-slate-200 dark:border-slate-600 w-full h-24 focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                                    value={smsDraft}
                                    onChange={(e) => setSmsDraft(e.target.value)}
                                />
                            )}
                            {!draftingSms && (
                                <div className="mt-3 flex justify-end gap-2">
                                    <button
                                        onClick={handleConfirmSendSms}
                                        disabled={sendingSms}
                                        className="text-xs font-semibold bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {sendingSms ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                        Send SMS
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Detailed Notes with AI */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-4">
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-slate-400" />
                                        Clinical Notes
                                    </h3>
                                    <button
                                        onClick={() => handleAnalyzeNotes(patient.notes)}
                                        disabled={isAnalyzing}
                                        className="flex items-center text-xs font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        {isAnalyzing ? <Activity className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                                        Summarize with AI
                                    </button>
                                </div>
                                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm">{patient.notes}</p>

                                {aiAnalysis && (
                                    <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-sm whitespace-pre-line animate-in fade-in">
                                        <div className="flex items-center gap-2 mb-2 font-bold text-indigo-700 dark:text-indigo-300">
                                            <Sparkles className="w-4 h-4" /> Smart Summary
                                        </div>
                                        {aiAnalysis}
                                    </div>
                                )}
                            </div>

                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-slate-900 dark:text-white">Visit History</h3>
                                    <button
                                        onClick={() => setIsAddingHistory(!isAddingHistory)}
                                        className="text-xs text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 font-medium flex items-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" /> Add Visit
                                    </button>
                                </div>

                                {isAddingHistory && (
                                    <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-100 dark:border-slate-700 animate-in slide-in-from-top-2">
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">New Visit Summary</label>
                                        <textarea
                                            value={newHistoryNote}
                                            onChange={(e) => setNewHistoryNote(e.target.value)}
                                            placeholder="Enter visit summary (e.g. 'Routine Checkup - Prescribed Antibiotics')..."
                                            className="w-full text-sm p-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white mb-3 focus:ring-2 focus:ring-teal-500 outline-none resize-none"
                                            rows={3}
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => setIsAddingHistory(false)}
                                                className="text-xs px-3 py-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors font-medium"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => handleAddHistory(patient)}
                                                className="text-xs px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-bold"
                                            >
                                                Save Record
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    {patient.history.length > 0 ? patient.history.map((record, i) => (
                                        <div key={i} className="flex items-center justify-between pb-4 border-b border-slate-50 dark:border-slate-700 last:border-0 last:pb-0">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                                                <span className="text-slate-700 dark:text-slate-300 font-medium text-sm">{record}</span>
                                            </div>
                                            <button className="text-xs text-brand-600 dark:text-brand-400 font-medium hover:underline">View Report</button>
                                        </div>
                                    )) : (
                                        <p className="text-sm text-slate-400 italic">No previous visit history.</p>
                                    )}
                                </div>
                            </div>

                            {/* Medical Information & Emergency Contact */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                    <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                        <Activity className="w-5 h-5 text-red-500" />
                                        Medical Info
                                    </h3>
                                    <div className="space-y-3">
                                        <div>
                                            <span className="text-xs font-bold text-slate-400 uppercase block">Blood Group</span>
                                            <span className="text-sm font-bold text-red-600 dark:text-red-400">{patient.bloodGroup || 'Not Specified'}</span>
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-slate-400 uppercase block">Allergies</span>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {patient.allergies && patient.allergies.length > 0 ? (
                                                    patient.allergies.map((a, i) => (
                                                        <span key={i} className="px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-xs font-medium border border-red-100 dark:border-red-900/30">{a}</span>
                                                    ))
                                                ) : <span className="text-sm text-slate-500 italic">None reported</span>}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-slate-400 uppercase block">Medical History</span>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {patient.history && patient.history.length > 0 ? (
                                                    patient.history.map((h, i) => (
                                                        <span key={i} className="px-2 py-0.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded text-xs font-medium border border-orange-100 dark:border-orange-900/30">{h}</span>
                                                    ))
                                                ) : <span className="text-sm text-slate-500 italic">None reported</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                    <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                        <Phone className="w-5 h-5 text-blue-500" />
                                        Emergency Contact
                                    </h3>
                                    {patient.emergencyContact?.name ? (
                                        <div className="space-y-3">
                                            <div>
                                                <span className="text-xs font-bold text-slate-400 uppercase block">Name</span>
                                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{patient.emergencyContact.name}</span>
                                            </div>
                                            <div>
                                                <span className="text-xs font-bold text-slate-400 uppercase block">Relationship</span>
                                                <span className="text-sm text-slate-600 dark:text-slate-400">{patient.emergencyContact.relationship}</span>
                                            </div>
                                            <div>
                                                <span className="text-xs font-bold text-slate-400 uppercase block">Phone</span>
                                                <a href={`tel:${patient.emergencyContact.phone}`} className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline">{patient.emergencyContact.phone}</a>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-400 italic">No emergency contact provided.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Vitals Sidebar */}
                        <div className="space-y-4">
                            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase">Vitals (Latest)</h4>
                                    {!isEditingVitals ? (
                                        <button
                                            onClick={() => {
                                                setTempVitals({
                                                    bp: patient.vitals?.bp || '',
                                                    heartRate: patient.vitals?.heartRate || '',
                                                    temp: patient.vitals?.temp || '',
                                                    weight: patient.vitals?.weight || ''
                                                });
                                                setIsEditingVitals(true);
                                            }}
                                            className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 font-bold"
                                        >
                                            <Edit2 className="w-3 h-3" /> Edit
                                        </button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setIsEditingVitals(false)}
                                                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const updated = { ...patient, vitals: tempVitals };
                                                    updatePatient(updated);
                                                    setSelectedPatient(updated);
                                                    setIsEditingVitals(false);
                                                }}
                                                className="text-xs text-teal-600 font-bold hover:text-teal-700 dark:hover:text-teal-300 flex items-center gap-1"
                                            >
                                                <Check className="w-3 h-3" /> Save
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Blood Pressure</div>
                                        {isEditingVitals ? (
                                            <input
                                                value={tempVitals.bp}
                                                onChange={(e) => setTempVitals({ ...tempVitals, bp: e.target.value })}
                                                className="w-full text-lg font-bold p-1.5 border border-slate-200 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                                                placeholder="120/80"
                                            />
                                        ) : (
                                            <div className="text-2xl font-bold text-slate-900 dark:text-white">{patient.vitals?.bp || '--/--'}</div>
                                        )}
                                    </div>

                                    <div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Heart Rate</div>
                                        <div className="flex items-center gap-2">
                                            {isEditingVitals ? (
                                                <input
                                                    value={tempVitals.heartRate}
                                                    onChange={(e) => setTempVitals({ ...tempVitals, heartRate: e.target.value })}
                                                    className="w-full text-lg font-bold p-1.5 border border-slate-200 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                                                    placeholder="72"
                                                />
                                            ) : (
                                                <span className="text-2xl font-bold text-slate-900 dark:text-white">{patient.vitals?.heartRate || '--'}</span>
                                            )}
                                            <span className="text-sm font-normal text-slate-400">bpm</span>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Temperature</div>
                                        <div className="flex items-center gap-2">
                                            {isEditingVitals ? (
                                                <input
                                                    value={tempVitals.temp}
                                                    onChange={(e) => setTempVitals({ ...tempVitals, temp: e.target.value })}
                                                    className="w-full text-lg font-bold p-1.5 border border-slate-200 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                                                    placeholder="36.5"
                                                />
                                            ) : (
                                                <span className="text-2xl font-bold text-slate-900 dark:text-white">{patient.vitals?.temp || '--'}</span>
                                            )}
                                            <span className="text-sm font-normal text-slate-400">°C</span>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Weight</div>
                                        <div className="flex items-center gap-2">
                                            {isEditingVitals ? (
                                                <input
                                                    value={tempVitals.weight}
                                                    onChange={(e) => setTempVitals({ ...tempVitals, weight: e.target.value })}
                                                    className="w-full text-lg font-bold p-1.5 border border-slate-200 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                                                    placeholder="70"
                                                />
                                            ) : (
                                                <span className="text-2xl font-bold text-slate-900 dark:text-white">{patient.vitals?.weight || '--'}</span>
                                            )}
                                            <span className="text-sm font-normal text-slate-400">kg</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );

    return (
        <div className="p-4 md:p-8 bg-gray-50 dark:bg-slate-900 min-h-screen transition-colors duration-200">
            {/* Print-only header */}
            <div className="hidden print-only mb-8 text-center border-b pb-4">
                <h1 className="text-3xl font-bold">JuaAfya Clinic</h1>
                <p>Patient Records Report</p>
                <p className="text-sm text-slate-500">{new Date().toLocaleDateString()}</p>
            </div>

            {selectedPatient ? renderPatientDetail(selectedPatient) : (
                <>
                    {/* Edit Patient Modal */}
                    {isEditing && editFormData && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in no-print">
                            <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                                <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-700/50 sticky top-0 z-10">
                                    <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                                        <Edit2 className="w-5 h-5 text-teal-600" /> Edit Patient
                                    </h3>
                                    <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                                </div>
                                <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                                        <input
                                            name="name"
                                            value={editFormData.name}
                                            onChange={handleEditChange}
                                            className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                                            <input
                                                name="phone"
                                                value={editFormData.phone}
                                                onChange={handleEditChange}
                                                className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Age</label>
                                            <input
                                                name="age"
                                                type="number"
                                                value={editFormData.age}
                                                onChange={handleEditChange}
                                                className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Gender</label>
                                        <select
                                            name="gender"
                                            value={editFormData.gender}
                                            onChange={handleEditChange}
                                            className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                        >
                                            <option value={Gender.Male}>Male</option>
                                            <option value={Gender.Female}>Female</option>
                                            <option value={Gender.Other}>Other</option>
                                        </select>
                                    </div>

                                    {/* Medical Details Section */}
                                    <div className="pt-2">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Medical Details</h4>
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div className="col-span-2 sm:col-span-1">
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Blood Group</label>
                                                <select
                                                    name="bloodGroup"
                                                    value={editFormData.bloodGroup}
                                                    onChange={handleEditChange}
                                                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                                >
                                                    <option value="">Select Blood Group</option>
                                                    <option value="A+">A+</option>
                                                    <option value="A-">A-</option>
                                                    <option value="B+">B+</option>
                                                    <option value="B-">B-</option>
                                                    <option value="AB+">AB+</option>
                                                    <option value="AB-">AB-</option>
                                                    <option value="O+">O+</option>
                                                    <option value="O-">O-</option>
                                                </select>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Allergies (comma separated)</label>
                                                <input
                                                    name="allergies"
                                                    value={editFormData.allergies}
                                                    onChange={handleEditChange}
                                                    placeholder="e.g. Penicillin, Peanuts"
                                                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Chronic Conditions (comma separated)</label>
                                                <input
                                                    id="history"
                                                    name="history"
                                                    value={editFormData.history.join(', ')}
                                                    onChange={(e) => setEditFormData({ ...editFormData, history: e.target.value.split(',').map(s => s.trim()) })}
                                                    placeholder="e.g. Diabetes, Hypertension"
                                                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                                />
                                            </div>
                                        </div>

                                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Emergency Contact</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2 sm:col-span-1">
                                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Contact Name</label>
                                                <input
                                                    name="emergencyContactName"
                                                    value={editFormData.emergencyContactName}
                                                    onChange={handleEditChange}
                                                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                                />
                                            </div>
                                            <div className="col-span-2 sm:col-span-1">
                                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Phone Number</label>
                                                <input
                                                    name="emergencyContactPhone"
                                                    value={editFormData.emergencyContactPhone}
                                                    onChange={handleEditChange}
                                                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Relationship</label>
                                                <input
                                                    name="emergencyContactRel"
                                                    value={editFormData.emergencyContactRel}
                                                    onChange={handleEditChange}
                                                    placeholder="e.g. Spouse, Parent"
                                                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Vitals Section */}
                                    <div className="pt-2">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Update Vitals</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Blood Pressure</label>
                                                <input
                                                    name="bp"
                                                    placeholder="120/80"
                                                    value={editFormData.vitals?.bp || ''}
                                                    onChange={handleEditVitalChange}
                                                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Heart Rate (bpm)</label>
                                                <input
                                                    name="heartRate"
                                                    type="number"
                                                    placeholder="72"
                                                    value={editFormData.vitals?.heartRate || ''}
                                                    onChange={handleEditVitalChange}
                                                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Temperature (°C)</label>
                                                <input
                                                    name="temp"
                                                    placeholder="36.5"
                                                    value={editFormData.vitals?.temp || ''}
                                                    onChange={handleEditVitalChange}
                                                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Weight (kg)</label>
                                                <input
                                                    name="weight"
                                                    placeholder="70"
                                                    value={editFormData.vitals?.weight || ''}
                                                    onChange={handleEditVitalChange}
                                                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                                        <textarea
                                            name="notes"
                                            value={editFormData.notes}
                                            onChange={handleEditChange}
                                            rows={3}
                                            className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm resize-none"
                                        />
                                    </div>
                                    <div className="flex gap-3 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!canDelete) {
                                                    useStore.getState().actions.showToast('You do not have permission to delete patients.', 'error')
                                                    return
                                                }
                                                handleDelete(editFormData.id)
                                            }}
                                            aria-disabled={!canDelete}
                                            disabled={!canDelete}
                                            className={`px-4 py-2 ${canDelete ? 'text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40' : 'text-slate-400 bg-red-50 opacity-60 cursor-not-allowed'} rounded-lg transition-colors flex items-center justify-center gap-2`}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <div className="flex-1 flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setIsEditing(false)}
                                                className="flex-1 py-2 text-slate-600 dark:text-slate-300 font-medium bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                className="flex-1 py-2 text-white font-medium bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Save className="w-4 h-4" /> Save Changes
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Add Patient Modal */}
                    {isAdding && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in no-print">
                            <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                                <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-700/50 sticky top-0 z-10">
                                    <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                                        <User className="w-5 h-5 text-teal-600" /> Add New Patient
                                    </h3>
                                    <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                                </div>
                                <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                                        <input
                                            name="name"
                                            value={newPatientData.name}
                                            onChange={handleAddChange}
                                            placeholder="e.g. John Doe"
                                            className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                                            <input
                                                name="phone"
                                                value={newPatientData.phone}
                                                onChange={handleAddChange}
                                                placeholder="+254..."
                                                className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Age</label>
                                            <input
                                                name="age"
                                                type="number"
                                                value={newPatientData.age}
                                                onChange={handleAddChange}
                                                placeholder="0"
                                                className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Gender</label>
                                        <select
                                            name="gender"
                                            value={newPatientData.gender}
                                            onChange={handleAddChange}
                                            className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                        >
                                            <option value={Gender.Male}>Male</option>
                                            <option value={Gender.Female}>Female</option>
                                            <option value={Gender.Other}>Other</option>
                                        </select>
                                    </div>

                                    {/* Medical Details Section */}
                                    <div className="pt-2">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Medical Details</h4>
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div className="col-span-2 sm:col-span-1">
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Blood Group</label>
                                                <select
                                                    name="bloodGroup"
                                                    value={newPatientData.bloodGroup}
                                                    onChange={handleAddChange}
                                                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                                >
                                                    <option value="">Select Blood Group</option>
                                                    <option value="A+">A+</option>
                                                    <option value="A-">A-</option>
                                                    <option value="B+">B+</option>
                                                    <option value="B-">B-</option>
                                                    <option value="AB+">AB+</option>
                                                    <option value="AB-">AB-</option>
                                                    <option value="O+">O+</option>
                                                    <option value="O-">O-</option>
                                                </select>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Allergies (comma separated)</label>
                                                <input
                                                    name="allergies"
                                                    value={newPatientData.allergies}
                                                    onChange={handleAddChange}
                                                    placeholder="e.g. Penicillin, Peanuts"
                                                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Chronic Conditions (comma separated)</label>
                                                <input
                                                    id="history"
                                                    name="history"
                                                    value={newPatientData.history}
                                                    onChange={handleAddChange}
                                                    placeholder="e.g. Diabetes, Hypertension"
                                                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                                />
                                            </div>
                                        </div>

                                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Emergency Contact</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2 sm:col-span-1">
                                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Contact Name</label>
                                                <input
                                                    name="emergencyContactName"
                                                    value={newPatientData.emergencyContactName}
                                                    onChange={handleAddChange}
                                                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                                />
                                            </div>
                                            <div className="col-span-2 sm:col-span-1">
                                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Phone Number</label>
                                                <input
                                                    name="emergencyContactPhone"
                                                    value={newPatientData.emergencyContactPhone}
                                                    onChange={handleAddChange}
                                                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Relationship</label>
                                                <input
                                                    name="emergencyContactRel"
                                                    value={newPatientData.emergencyContactRel}
                                                    onChange={handleAddChange}
                                                    placeholder="e.g. Spouse, Parent"
                                                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Vitals Section */}
                                    <div className="pt-2">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Initial Vitals (Optional)</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Blood Pressure</label>
                                                <input
                                                    name="bp"
                                                    placeholder="120/80"
                                                    value={newPatientData.vitals.bp}
                                                    onChange={handleAddVitalChange}
                                                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Heart Rate (bpm)</label>
                                                <input
                                                    name="heartRate"
                                                    type="number"
                                                    placeholder="72"
                                                    value={newPatientData.vitals.heartRate}
                                                    onChange={handleAddVitalChange}
                                                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Temperature (°C)</label>
                                                <input
                                                    name="temp"
                                                    placeholder="36.5"
                                                    value={newPatientData.vitals.temp}
                                                    onChange={handleAddVitalChange}
                                                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Weight (kg)</label>
                                                <input
                                                    name="weight"
                                                    placeholder="70"
                                                    value={newPatientData.vitals.weight}
                                                    onChange={handleAddVitalChange}
                                                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Initial Notes</label>
                                        <textarea
                                            name="notes"
                                            value={newPatientData.notes}
                                            onChange={handleAddChange}
                                            rows={3}
                                            placeholder="Reason for visit..."
                                            className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-white text-sm resize-none"
                                        />
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsAdding(false)}
                                            className="flex-1 py-2 text-slate-600 dark:text-slate-300 font-medium bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 py-2 text-white font-medium bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Plus className="w-4 h-4" /> Add Patient
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 no-print">
                        <div className="space-y-2">
                            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Patients</h2>
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                                <span className="bg-teal-600 text-white px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap shadow-sm shadow-teal-500/20">Daily</span>
                                <span className="bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors border border-slate-100 dark:border-slate-700 whitespace-nowrap shadow-sm">Weekly</span>
                                <span className="bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors border border-slate-100 dark:border-slate-700 whitespace-nowrap shadow-sm">Monthly</span>
                            </div>
                        </div>

                        <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-3 w-full xl:w-auto">
                            {/* Filter Controls */}
                            <div className="flex items-center gap-2 overflow-x-auto pb-2 xl:pb-0 scrollbar-hide">
                                <div className="relative shrink-0 min-w-[120px]">
                                    <select
                                        className="w-full appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 pl-3 pr-8 py-2.5 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-4 focus:ring-brand-500/10 cursor-pointer shadow-sm"
                                        value={genderFilter}
                                        onChange={(e) => setGenderFilter(e.target.value)}
                                    >
                                        <option value="All">All Genders</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    <Filter className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <input
                                        type="number"
                                        placeholder="Min"
                                        value={minAge}
                                        onChange={(e) => setMinAge(e.target.value)}
                                        className="w-14 sm:w-16 pl-3 pr-1 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-4 focus:ring-brand-500/10 shadow-sm"
                                    />
                                    <span className="text-slate-400 text-xs font-bold">-</span>
                                    <input
                                        type="number"
                                        placeholder="Max"
                                        value={maxAge}
                                        onChange={(e) => setMaxAge(e.target.value)}
                                        className="w-14 sm:w-16 pl-3 pr-1 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-4 focus:ring-brand-500/10 shadow-sm"
                                    />
                                </div>
                                <div className="relative shrink-0 min-w-[140px]">
                                    <select
                                        className="w-full appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 pl-3 pr-8 py-2.5 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-4 focus:ring-brand-500/10 cursor-pointer shadow-sm"
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                    >
                                        <option value="All">All Statuses</option>
                                        <option value="Active">Active (&lt;1yr)</option>
                                        <option value="Inactive">Inactive (&gt;=1yr)</option>
                                    </select>
                                    <Filter className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                                <div className="relative shrink-0 min-w-[130px]">
                                    <select
                                        className="w-full appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 pl-3 pr-8 py-2.5 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-4 focus:ring-brand-500/10 cursor-pointer shadow-sm"
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                    >
                                        <option value="Recent">Sort: Recent</option>
                                        <option value="Name">Sort: Name</option>
                                        <option value="Age">Sort: Age</option>
                                    </select>
                                    <Filter className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 w-full xl:w-auto">
                                <div className="relative group flex-1 xl:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5 group-focus-within:text-brand-500 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Search patients..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10 pr-10 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-white rounded-xl text-xs sm:text-sm font-medium w-full shadow-sm focus:ring-4 focus:ring-brand-500/10 focus:outline-none placeholder-slate-400 transition-all"
                                    />
                                    {searchTerm && (
                                        <button
                                            onClick={() => setSearchTerm('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => { if (!canCreate) { actions.showToast('You do not have permission to create patients.', 'error'); return } setIsAdding(true) }}
                                        aria-disabled={!canCreate}
                                        disabled={!canCreate}
                                        className={`bg-slate-900 dark:bg-brand-600 text-white p-2.5 rounded-xl ${canCreate ? 'hover:bg-slate-800 dark:hover:bg-brand-700 hover:shadow-lg' : 'opacity-60 cursor-not-allowed'} transition-all shadow-sm shadow-slate-200 dark:shadow-none shrink-0`}
                                        title="Add Patient"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => { if (!canExport) { actions.showToast('You do not have permission to export patients.', 'error'); return } handleExportAll() }}
                                        aria-disabled={!canExport}
                                        disabled={!canExport}
                                        className={`bg-white dark:bg-slate-800 text-slate-800 dark:text-white p-2.5 rounded-xl ${canExport ? 'hover:bg-slate-50 dark:hover:bg-slate-700 hover:shadow-lg' : 'opacity-60 cursor-not-allowed'} transition-all border border-slate-200 dark:border-slate-700 shrink-0 shadow-sm`}
                                        title="Export Patients"
                                    >
                                        <Download className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => { if (!canCreate) { actions.showToast('You do not have permission to import patients.', 'error'); return } setShowBulkImport(true) }}
                                        aria-disabled={!canCreate}
                                        disabled={!canCreate}
                                        className={`bg-white dark:bg-slate-800 text-slate-800 dark:text-white p-2.5 rounded-xl ${canCreate ? 'hover:bg-slate-50 dark:hover:bg-slate-700 hover:shadow-lg' : 'opacity-60 cursor-not-allowed'} transition-all border border-slate-200 dark:border-slate-700 shrink-0 shadow-sm`}
                                        title="Bulk Import Patients"
                                    >
                                        <Upload className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden transition-colors duration-200 flex flex-col min-h-[400px]">
                        <div className="flex-1 overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead className="bg-gray-50/50 dark:bg-slate-700/50 text-xs uppercase text-slate-400 font-semibold border-b border-gray-100 dark:border-slate-700">
                                    <tr>
                                        <th className="px-6 py-4">ID</th>
                                        <th className="px-6 py-4">Name</th>
                                        <th className="px-6 py-4">Age</th>
                                        <th className="px-6 py-4">Last Visit</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Report</th>
                                        <th className="px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-slate-700 text-sm">
                                    {paginatedPatients.length > 0 ? paginatedPatients.map((patient) => (
                                        <tr
                                            key={patient.id}
                                            className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group"
                                            onClick={() => setSelectedPatient(patient)}
                                        >
                                            <td className="px-6 py-4 font-mono text-slate-500 dark:text-slate-400 text-xs">
                                                #{patient.id}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                                        <img src={getAvatarUrl(patient.name)} alt="Avatar" className="w-full h-full object-cover" />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-900 dark:text-white">{patient.name}</div>
                                                        <div className="text-xs text-slate-400">{patient.phone}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium">{patient.age} years</td>
                                            <td className="px-6 py-4">
                                                <div className="text-slate-900 dark:text-slate-200 font-medium">{patient.lastVisit}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 px-3 py-1 rounded-full text-xs font-semibold">
                                                    Registered
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); handleExportPatient(patient); }}
                                                    role="button"
                                                    className="flex items-center gap-2 text-slate-400 hover:text-brand-600 transition-colors cursor-pointer"
                                                >
                                                    <FileText className="w-4 h-4" />
                                                    <span className="text-xs font-medium">Export</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right relative">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === patient.id ? null : patient.id); }}
                                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-full text-slate-400 transition-colors"
                                                >
                                                    <MoreHorizontal className="w-5 h-5" />
                                                </button>

                                                {/* Action Menu */}
                                                {activeMenuId === patient.id && (
                                                    <div className="absolute right-8 top-8 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-20 animate-in zoom-in-95 origin-top-right">
                                                        <div className="p-1">
                                                            <button onClick={(e) => { e.stopPropagation(); setSelectedPatient(patient); setActiveMenuId(null); }} className="w-full text-left px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2">
                                                                <Eye className="w-4 h-4" /> View Details
                                                            </button>
                                                            <button onClick={(e) => { e.stopPropagation(); handleEditClick(patient); }} className="w-full text-left px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2">
                                                                <Edit2 className="w-4 h-4" /> Edit Profile
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); if (!canExport) { useStore.getState().actions.showToast('You do not have permission to export patients.', 'error'); return } handleExportPatient(patient); }}
                                                                aria-disabled={!canExport}
                                                                disabled={!canExport}
                                                                className={`w-full text-left px-3 py-2 text-sm ${canExport ? 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700' : 'text-slate-400 cursor-not-allowed'} rounded-lg flex items-center gap-2`}
                                                            >
                                                                <Download className="w-4 h-4" /> Export Patient
                                                            </button>
                                                            <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); if (!canDelete) { useStore.getState().actions.showToast('You do not have permission to delete patients.', 'error'); return } handleDelete(patient.id); }}
                                                                aria-disabled={!canDelete}
                                                                disabled={!canDelete}
                                                                className={`w-full text-left px-3 py-2 text-sm ${canDelete ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium' : 'text-slate-400 cursor-not-allowed'} rounded-lg flex items-center gap-2`}
                                                            >
                                                                <Trash2 className="w-4 h-4" /> Delete Patient
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                                No patients found matching your criteria.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between mt-auto">
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                    Showing page {currentPage} of {totalPages}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 dark:text-slate-300"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 dark:text-slate-300"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Bulk Import Dialog */}
            {showBulkImport && (
                <BulkImportPatients
                    onImport={handleBulkImport}
                    onClose={() => setShowBulkImport(false)}
                />
            )}
        </div>
    );
};

export default PatientList;

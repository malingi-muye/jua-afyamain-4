import React, { useState, useEffect } from 'react';
import { Patient, Gender, ClinicSettings } from '../types';
import {
    MessageSquare, Users, Send, Clock, CheckCircle, AlertCircle,
    Search, Filter, Sparkles, X, History, Plus, Loader2, Play,
    Trash2, Edit3, FolderPlus, UserPlus, RefreshCw, ChevronRight,
    Group
} from 'lucide-react';
import { draftCampaignMessage } from '../services/geminiService';
import { sendSMS } from '../services/smsService';
import { enterpriseDb } from '../services/enterprise-db';
import { mobiwaveService, MobiwaveContact, MobiwaveGroup } from '../services/mobiwaveService';

interface BulkSMSProps {
    patients: Patient[];
    showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
    settings?: ClinicSettings;
}

interface Campaign {
    id: string;
    date: string;
    message: string;
    recipientCount: number;
    status: 'Completed' | 'Failed';
    cost: number;
    type: 'Broadcast' | 'Reminder';
}

const BulkSMS: React.FC<BulkSMSProps> = ({ patients, showToast, settings }) => {
    const [activeTab, setActiveTab] = useState<'compose' | 'history' | 'contacts'>('compose');
    const [loadingAI, setLoadingAI] = useState(false);

    // -- Compose State --
    const [message, setMessage] = useState('');
    const [audience, setAudience] = useState<'all' | 'male' | 'female' | 'manual' | 'group'>('all');
    const [manualNumbers, setManualNumbers] = useState('');
    const [selectedGroupId, setSelectedGroupId] = useState('');

    // -- Contacts & Groups State --
    const [groups, setGroups] = useState<MobiwaveGroup[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<MobiwaveGroup | null>(null);
    const [contacts, setContacts] = useState<MobiwaveContact[]>([]);
    const [isLoadingGroups, setIsLoadingGroups] = useState(false);
    const [isLoadingContacts, setIsLoadingContacts] = useState(false);

    // -- Modals --
    const [showAiModal, setShowAiModal] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [contactForm, setContactForm] = useState({ phone: '', firstName: '', lastName: '', uid: '' });

    const [aiTopic, setAiTopic] = useState('');
    const [aiTone, setAiTone] = useState('Professional');

    // -- Sending State --
    const [isSending, setIsSending] = useState(false);
    const [progress, setProgress] = useState(0);
    const [sentCount, setSentCount] = useState(0);
    const [totalToSend, setTotalToSend] = useState(0);

    // -- History State --
    const [history, setHistory] = useState<Campaign[]>([]);

    useEffect(() => {
        if (activeTab === 'contacts' || audience === 'group') {
            fetchGroups();
        }
    }, [activeTab, audience]);

    const fetchGroups = async () => {
        setIsLoadingGroups(true);
        const res = await mobiwaveService.getGroups();
        if (res.status === 'success' && res.data) {
            setGroups(res.data.data || []);
        } else {
            showToast(res.message || 'Failed to fetch groups', 'error');
        }
        setIsLoadingGroups(false);
    };

    const fetchContacts = async (groupId: string) => {
        setIsLoadingContacts(true);
        const res = await mobiwaveService.getContactsInGroup(groupId);
        if (res.status === 'success' && res.data) {
            setContacts(res.data.data || []);
        } else {
            showToast(res.message || 'Failed to fetch contacts', 'error');
        }
        setIsLoadingContacts(false);
    };

    const handleCreateGroup = async () => {
        if (!newGroupName) return;
        const res = await mobiwaveService.storeGroup(newGroupName);
        if (res.status === 'success') {
            showToast('Group created successfully', 'success');
            setNewGroupName('');
            setShowGroupModal(false);
            fetchGroups();
        } else {
            showToast(res.message || 'Failed to create group', 'error');
        }
    };

    const handleDeleteGroup = async (id: string) => {
        if (!confirm('Are you sure you want to delete this group?')) return;
        const res = await mobiwaveService.deleteGroup(id);
        if (res.status === 'success') {
            showToast('Group deleted', 'success');
            if (selectedGroup?.uid === id) {
                setSelectedGroup(null);
                setContacts([]);
            }
            fetchGroups();
        } else {
            showToast(res.message || 'Failed to delete group', 'error');
        }
    };

    const handleSaveContact = async () => {
        if (!selectedGroup || !contactForm.phone) return;

        let res;
        if (contactForm.uid) {
            res = await mobiwaveService.updateContact(selectedGroup.uid, contactForm.uid, contactForm.phone, contactForm.firstName, contactForm.lastName);
        } else {
            res = await mobiwaveService.storeContact(selectedGroup.uid, contactForm.phone, contactForm.firstName, contactForm.lastName);
        }

        if (res.status === 'success') {
            showToast(contactForm.uid ? 'Contact updated' : 'Contact added', 'success');
            setShowContactModal(false);
            setContactForm({ phone: '', firstName: '', lastName: '', uid: '' });
            fetchContacts(selectedGroup.uid);
        } else {
            showToast(res.message || 'Operation failed', 'error');
        }
    };

    const handleDeleteContact = async (uid: string) => {
        if (!selectedGroup) return;
        if (!confirm('Delete this contact?')) return;
        const res = await mobiwaveService.deleteContact(selectedGroup.uid, uid);
        if (res.status === 'success') {
            showToast('Contact removed', 'success');
            fetchContacts(selectedGroup.uid);
        } else {
            showToast(res.message || 'Failed to delete contact', 'error');
        }
    };

    // -- Helpers --
    const getRecipients = () => {
        if (audience === 'all') return patients;
        if (audience === 'male') return patients.filter(p => p.gender === Gender.Male);
        if (audience === 'female') return patients.filter(p => p.gender === Gender.Female);
        if (audience === 'group') return []; // Handled separately via campaign API

        // Manual parsing
        if (audience === 'manual') {
            return manualNumbers.split(',').map((num, idx) => ({
                id: `manual-${idx}`,
                name: 'Unknown',
                phone: num.trim(),
                age: 0,
                gender: Gender.Other,
                lastVisit: '',
                notes: '',
                history: []
            })).filter(p => p.phone.length > 5); // Basic filter
        }
        return [];
    };

    const recipients = getRecipients();
    const estimatedCost = audience === 'group' ? 0 : recipients.length * 1.5; // Assuming 1.5 KSh per SMS

    const handleGenerateAI = async () => {
        if (!aiTopic) return;
        setLoadingAI(true);
        const draft = await draftCampaignMessage(aiTopic, aiTone);
        setMessage(draft);
        setLoadingAI(false);
        setShowAiModal(false);
    };

    const handleSendCampaign = async () => {
        if (!message) return;
        if (audience !== 'group' && recipients.length === 0) return;
        if (audience === 'group' && !selectedGroupId) return;

        setIsSending(true);
        setProgress(0);
        setSentCount(0);

        if (audience === 'group') {
            // Use Mobiwave Campaign API
            const res = await mobiwaveService.sendCampaign(selectedGroupId, message, settings?.smsConfig?.senderId);
            if (res.status === 'success') {
                showToast('Group campaign launched successfully!', 'success');
            } else {
                showToast(res.message || 'Failed to start group campaign', 'error');
            }
        } else {
            // Iterative sending
            setTotalToSend(recipients.length);
            const campaignId = `campaign-${Date.now()}`;

            let successCount = 0;
            const batchSize = 5;
            for (let i = 0; i < recipients.length; i += batchSize) {
                const batch = recipients.slice(i, i + batchSize);
                await Promise.all(batch.map(async (recipient) => {
                    try {
                        const res = await mobiwaveService.sendSMS(recipient.phone, message, settings?.smsConfig?.senderId);
                        if (res.status === 'success') successCount++;
                    } catch (error) {
                        console.error('Error sending SMS to', recipient.phone, error);
                    }
                }));

                const currentSent = Math.min(i + batchSize, recipients.length);
                setSentCount(currentSent);
                setProgress((currentSent / recipients.length) * 100);
            }

            showToast(`Campaign sent! ${successCount}/${recipients.length} messages delivered.`, 'success');

            const newCampaign: Campaign = {
                id: campaignId,
                date: new Date().toISOString().split('T')[0],
                message: message.substring(0, 50) + '...',
                recipientCount: successCount,
                status: successCount > 0 ? 'Completed' : 'Failed',
                cost: successCount * 1.5,
                type: 'Broadcast'
            };
            setHistory([newCampaign, ...history]);
        }

        setIsSending(false);
        setMessage('');
        setAudience('all');
    };

    return (
        <div className="p-4 md:p-8 bg-gray-50 dark:bg-slate-900 min-h-screen transition-colors duration-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Broadcast SMS</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Reach your patients with bulk messaging campaigns.</p>
                </div>

                {/* Toggle Tabs */}
                <div className="flex p-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto scrollbar-none">
                    <button
                        onClick={() => setActiveTab('compose')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'compose' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    >
                        <MessageSquare className="w-4 h-4" /> Compose
                    </button>
                    <button
                        onClick={() => setActiveTab('contacts')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'contacts' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    >
                        <Users className="w-4 h-4" /> Contacts & Groups
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'history' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    >
                        <History className="w-4 h-4" /> History
                    </button>
                </div>
            </div>

            {activeTab === 'compose' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                            <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <Users className="w-5 h-5 text-teal-600" /> Target Audience
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                                {[
                                    { id: 'all', label: 'All Patients' },
                                    { id: 'male', label: 'Male' },
                                    { id: 'female', label: 'Female' },
                                    { id: 'group', label: 'Group List' },
                                    { id: 'manual', label: 'Manual' }
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setAudience(opt.id as any)}
                                        className={`p-3 rounded-xl border-2 text-xs font-bold transition-all ${audience === opt.id
                                            ? 'border-teal-600 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400'
                                            : 'border-slate-100 dark:border-slate-700 hover:border-teal-200 dark:hover:border-slate-600 text-slate-600 dark:text-slate-300'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>

                            {audience === 'manual' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Enter Phone Numbers (comma separated)</label>
                                    <textarea
                                        value={manualNumbers}
                                        onChange={(e) => setManualNumbers(e.target.value)}
                                        placeholder="+254712345678, +254700000000"
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none dark:text-white h-24"
                                    />
                                </div>
                            )}

                            {audience === 'group' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Select Mobiwave Contact Group</label>
                                    <select
                                        value={selectedGroupId}
                                        onChange={(e) => setSelectedGroupId(e.target.value)}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                                    >
                                        <option value="">-- Choose a group --</option>
                                        {groups.map(g => (
                                            <option key={g.uid} value={g.uid}>{g.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {audience !== 'manual' && audience !== 'group' && (
                                <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <Filter className="w-4 h-4 text-slate-400" />
                                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Selected Recipients</span>
                                    </div>
                                    <span className="text-lg font-bold text-teal-600 dark:text-teal-400">{recipients.length} Patients</span>
                                </div>
                            )}
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-teal-600" /> Message Content
                                </h3>
                                <button
                                    onClick={() => setShowAiModal(true)}
                                    className="text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                >
                                    <Sparkles className="w-3.5 h-3.5" /> Draft with AI
                                </button>
                            </div>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className="w-full p-4 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none dark:text-white h-40 resize-none font-medium leading-relaxed"
                                placeholder={"Type your message here..."}
                            />
                            <div className="flex justify-between items-center mt-3 text-xs text-slate-500 font-medium">
                                <span>{message.length} chars | {Math.ceil(message.length / 160)} segment(s)</span>
                                <span className={message.length > 160 ? 'text-amber-500' : ''}>Max 160 recommended</span>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 sticky top-4">
                            <h3 className="font-bold text-slate-900 dark:text-white mb-6">Campaign Summary</h3>
                            <div className="space-y-4 mb-8">
                                <div className="flex justify-between items-center pb-4 border-b dark:border-slate-700">
                                    <span className="text-slate-500 text-sm">Targeting</span>
                                    <span className="font-bold dark:text-white">{audience === 'group' ? 'Contact Group' : `${recipients.length} Recipients`}</span>
                                </div>
                                <div className="flex justify-between items-center pb-4 border-b dark:border-slate-700">
                                    <span className="text-slate-500 text-sm">Segments</span>
                                    <span className="font-bold dark:text-white">{Math.max(1, Math.ceil(message.length / 160))}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2">
                                    <span className="font-bold dark:text-white">Estimated Cost</span>
                                    <span className="font-bold text-xl text-teal-600">KSh {estimatedCost.toLocaleString()}</span>
                                </div>
                            </div>

                            {!isSending ? (
                                <button
                                    onClick={handleSendCampaign}
                                    disabled={!message || (audience !== 'group' && recipients.length === 0)}
                                    className="w-full py-4 bg-slate-900 dark:bg-teal-600 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <Send className="w-5 h-5" /> Send Campaign
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex justify-between text-xs font-bold dark:text-white">
                                        <span>Sending...</span>
                                        <span>{Math.round(progress)}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                                        <div className="bg-teal-500 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
                                    </div>
                                    <div className="text-center text-xs text-slate-400">{sentCount} delivered</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'contacts' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 animate-in fade-in slide-in-from-bottom-4">
                    {/* Groups Sidebar */}
                    <div className="md:col-span-1 space-y-4">
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-bold dark:text-white">Groups</h4>
                                <button onClick={() => setShowGroupModal(true)} className="p-1.5 bg-teal-50 text-teal-600 rounded-lg hover:bg-teal-100 transition-colors">
                                    <FolderPlus className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="space-y-1">
                                {groups.map(group => (
                                    <div
                                        key={group.uid}
                                        onClick={() => {
                                            setSelectedGroup(group);
                                            fetchContacts(group.uid);
                                        }}
                                        className={`w-full p-3 rounded-xl flex items-center justify-between group cursor-pointer transition-all ${selectedGroup?.uid === group.uid ? 'bg-teal-600 text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300'}`}
                                    >
                                        <span className="text-sm font-bold truncate">{group.name}</span>
                                        <Trash2
                                            onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.uid); }}
                                            className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 ${selectedGroup?.uid === group.uid ? 'text-teal-200' : 'text-slate-400'}`}
                                        />
                                    </div>
                                ))}
                                {groups.length === 0 && !isLoadingGroups && (
                                    <p className="text-xs text-slate-400 text-center py-4">No groups found</p>
                                )}
                                {isLoadingGroups && <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-teal-600" /></div>}
                            </div>
                        </div>
                    </div>

                    {/* Contacts Content */}
                    <div className="md:col-span-3 space-y-4">
                        {selectedGroup ? (
                            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                                <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-700/30">
                                    <div>
                                        <h3 className="font-bold text-lg dark:text-white">{selectedGroup.name}</h3>
                                        <p className="text-sm text-slate-500">{contacts.length} Contacts</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => fetchContacts(selectedGroup.uid)}
                                            className="p-2.5 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 transition-all shadow-sm"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${isLoadingContacts ? 'animate-spin' : ''}`} />
                                        </button>
                                        <button
                                            onClick={() => { setContactForm({ phone: '', firstName: '', lastName: '', uid: '' }); setShowContactModal(true); }}
                                            className="bg-teal-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-teal-700 transition-all shadow-lg shadow-teal-100 dark:shadow-none"
                                        >
                                            <UserPlus className="w-4 h-4" /> Add Contact
                                        </button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-400 font-bold">
                                            <tr>
                                                <th className="px-6 py-4">Name</th>
                                                <th className="px-6 py-4">Phone Number</th>
                                                <th className="px-6 py-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-slate-700">
                                            {contacts.map(c => (
                                                <tr key={c.uid} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                    <td className="px-6 py-4 dark:text-white font-medium">
                                                        {c.first_name || c.last_name ? `${c.first_name || ''} ${c.last_name || ''}` : 'N/A'}
                                                    </td>
                                                    <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-300">{c.phone}</td>
                                                    <td className="px-6 py-4 text-right flex justify-end gap-3">
                                                        <button
                                                            onClick={() => { setContactForm({ phone: c.phone, firstName: c.first_name || '', lastName: c.last_name || '', uid: c.uid }); setShowContactModal(true); }}
                                                            className="text-indigo-600 hover:text-indigo-700 p-1"
                                                        >
                                                            <Edit3 className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleDeleteContact(c.uid)} className="text-red-500 hover:text-red-700 p-1">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {contacts.length === 0 && !isLoadingContacts && (
                                                <tr>
                                                    <td colSpan={3} className="px-6 py-12 text-center text-slate-400">No contacts in this group</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="h-64 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400">
                                <Group className="w-12 h-12 mb-3 opacity-20" />
                                <p className="font-medium">Select a group to manage contacts</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'history' && (
                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-400 font-bold border-b dark:border-slate-700">
                                <tr>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Message</th>
                                    <th className="px-6 py-4 text-center">Sent</th>
                                    <th className="px-6 py-4 text-center">Cost</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-slate-700">
                                {history.map(campaign => (
                                    <tr key={campaign.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                        <td className="px-6 py-4 text-sm dark:text-slate-300">{campaign.date}</td>
                                        <td className="px-6 py-4 text-sm font-medium dark:text-white truncate max-w-xs">{campaign.message}</td>
                                        <td className="px-6 py-4 text-center font-bold dark:text-white">{campaign.recipientCount}</td>
                                        <td className="px-6 py-4 text-center text-sm dark:text-slate-300">KSh {campaign.cost}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs font-bold ring-1 ring-green-100 dark:ring-green-900">
                                                Completed
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modals */}
            {showAiModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl">
                        <h3 className="text-xl font-bold mb-6 dark:text-white flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-indigo-500" /> AI Message Drafter
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">Topic</label>
                                <input value={aiTopic} onChange={e => setAiTopic(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" placeholder="e.g. Free Checkup" />
                            </div>
                            <div>
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">Tone</label>
                                <select value={aiTone} onChange={e => setAiTone(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white">
                                    <option value="Professional">Professional</option>
                                    <option value="Urgent">Urgent</option>
                                    <option value="Friendly">Friendly</option>
                                </select>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setShowAiModal(false)} className="flex-1 py-3 font-bold text-slate-600 bg-slate-100 dark:bg-slate-700 dark:text-slate-300 rounded-xl">Cancel</button>
                                <button onClick={handleGenerateAI} disabled={loadingAI || !aiTopic} className="flex-1 py-3 font-bold text-white bg-indigo-600 rounded-xl flex items-center justify-center gap-2">
                                    {loadingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generate
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showGroupModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                        <h3 className="text-xl font-bold mb-6 dark:text-white">Create Group</h3>
                        <div className="space-y-4">
                            <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white" placeholder="Group Name" autoFocus />
                            <div className="flex gap-3 mt-4">
                                <button onClick={() => setShowGroupModal(false)} className="flex-1 py-3 font-bold text-slate-600 bg-slate-100 dark:bg-slate-700 dark:text-slate-300 rounded-xl">Cancel</button>
                                <button onClick={handleCreateGroup} className="flex-1 py-3 font-bold text-white bg-teal-600 rounded-xl">Create</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showContactModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                        <h3 className="text-xl font-bold mb-6 dark:text-white">{contactForm.uid ? 'Edit Contact' : 'Add Contact'}</h3>
                        <div className="space-y-4">
                            <input value={contactForm.phone} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white" placeholder="Phone Number (e.g. 254...)" autoFocus />
                            <input value={contactForm.firstName} onChange={e => setContactForm({ ...contactForm, firstName: e.target.value })} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white" placeholder="First Name" />
                            <input value={contactForm.lastName} onChange={e => setContactForm({ ...contactForm, lastName: e.target.value })} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white" placeholder="Last Name" />
                            <div className="flex gap-3 mt-4">
                                <button onClick={() => setShowContactModal(false)} className="flex-1 py-3 font-bold text-slate-600 bg-slate-100 dark:bg-slate-700 dark:text-slate-300 rounded-xl">Cancel</button>
                                <button onClick={handleSaveContact} className="flex-1 py-3 font-bold text-white bg-teal-600 rounded-xl">Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BulkSMS;

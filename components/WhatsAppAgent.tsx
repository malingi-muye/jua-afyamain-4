import React, { useState, useRef, useEffect } from 'react';
import {
    Send, MessageSquare, Activity, Shield,
    CheckCircle, Power, Save, Terminal,
    Trash2, Link as LinkIcon, Copy, Database,
    Brain, Bot, Sparkles, User, Lock, Wifi,
    Loader2, Search, AlertCircle, Check, X,
    Zap
} from 'lucide-react';
import { TeamMember, Appointment, InventoryItem, Patient, ClinicSettings, Gender } from '../types';
import { getStaffAssistantResponse } from '../services/geminiService';
import { enterpriseDb } from '../services/enterprise-db';
import { supabase } from '../lib/supabaseClient';

interface WhatsAppAgentProps {
    team: TeamMember[];
    appointments: Appointment[];
    inventory: InventoryItem[];
    patients: Patient[];
    settings: ClinicSettings;
    // Actions
    addPatient: (p: Patient) => void;
    updatePatient: (p: Patient) => void;
    deletePatient: (id: string) => void;
    addAppointment: (a: Appointment) => void;
    updateAppointment: (a: Appointment) => void;
    updateInventoryItem: (i: InventoryItem, reason: string) => void;
    deleteInventoryItem: (id: string) => void;
    updateSettings: (s: ClinicSettings) => void;
}

interface LogEntry {
    id: string;
    timestamp: string;
    user: string;
    query: string;
    response: string;
    status: 'Success' | 'Failed';
}

interface ChatMessage {
    id: string;
    sender: 'user' | 'bot' | 'system';
    text: string;
    timestamp: string | Date; // Allow string for deserialization
    isAction?: boolean;
}

type AgentTab = 'playground' | 'brain' | 'connection' | 'logs';

const WhatsAppAgent: React.FC<WhatsAppAgentProps> = ({
    team, appointments, inventory, patients, settings,
    addPatient, updatePatient, deletePatient, addAppointment, updateAppointment, updateInventoryItem, deleteInventoryItem,
    updateSettings
}) => {
    const [activeTab, setActiveTab] = useState<AgentTab>('playground');
    const [botStatus, setBotStatus] = useState<'Active' | 'Paused'>('Active');
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    // -- AI Configuration --
    const [aiConfig, setAiConfig] = useState({
        persona: settings.whatsappConfig?.persona || 'Professional',
        accessInventory: settings.whatsappConfig?.capabilities.inventory ?? true,
        accessAppointments: settings.whatsappConfig?.capabilities.appointments ?? true,
        accessPatients: settings.whatsappConfig?.capabilities.patients ?? true,
        accessStaff: settings.whatsappConfig?.capabilities.staff ?? false
    });

    // -- Connection Config --
    const [connectionConfig, setConnectionConfig] = useState({
        provider: settings.whatsappConfig?.provider || 'Meta',
        phoneId: settings.whatsappConfig?.phoneId || '',
        accessToken: settings.whatsappConfig?.accessToken || '',
        webhookUrl: settings.whatsappConfig?.webhookUrl || 'https://api.juaafya.com/webhooks/whatsapp/v1/entry'
    });
    const [isTestingConnection, setIsTestingConnection] = useState(false);

    // -- Simulator State --
    const [selectedTestUser, setSelectedTestUser] = useState<string>(team[0]?.id || '');
    const [input, setInput] = useState('');

    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: 'init', sender: 'bot', text: 'JuaAfya Agent Online. How can I assist with clinic operations today?', timestamp: new Date().toISOString() }
    ]);

    const [isProcessing, setIsProcessing] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // -- Logs State --
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [logSearch, setLogSearch] = useState('');

    // -- Persistence --
    useEffect(() => {
        try {
            const savedMsgs = localStorage.getItem('wa_agent_messages');
            if (savedMsgs) setMessages(JSON.parse(savedMsgs));

            const savedLogs = localStorage.getItem('wa_agent_logs');
            if (savedLogs) setLogs(JSON.parse(savedLogs));
        } catch (e) {
            console.error("Error loading persisted agent data", e);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('wa_agent_messages', JSON.stringify(messages));
    }, [messages]);

    useEffect(() => {
        localStorage.setItem('wa_agent_logs', JSON.stringify(logs));
    }, [logs]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isProcessing, activeTab]);

    // Toast Timer
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
    };

    // -- Logic --

    const executeAction = async (action: any) => {
        try {
            // Send the requested action to the server-side handler which enforces RBAC, validation and audit logging.
            const { data, error } = await supabase.functions.invoke('whatsapp-action', {
                body: { action }
            });

            if (error) {
                console.error('whatsapp-action function error', error);
                return `❌ Error executing action: ${(error as any)?.message || 'server error'}`;
            }

            // Server may return entity updates to reflect in UI
            if (data?.updates) {
                const updates = data.updates;
                if (updates.addedPatient) addPatient(updates.addedPatient as Patient)
                if (updates.updatedPatient) updatePatient(updates.updatedPatient as Patient)
                if (updates.deletedPatientId) deletePatient(updates.deletedPatientId as string)
                if (updates.addedAppointment) addAppointment(updates.addedAppointment as Appointment)
                if (updates.updatedAppointment) updateAppointment(updates.updatedAppointment as Appointment)
                if (updates.updatedInventory) updateInventoryItem(updates.updatedInventory as InventoryItem, 'WhatsApp Adjustment')
            }

            return data?.message || '✅ Action executed via server'
        } catch (e) {
            console.error('executeAction error', e)
            return `❌ Error executing action: ${(e as any)?.message || String(e)}`
        }
    }

    const handleSendMessage = async () => {
        if (!input.trim() || !selectedTestUser) return;

        const user = team.find(t => t.id === selectedTestUser);
        if (!user) return;

        // 1. Add User Message
        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            sender: 'user',
            text: input,
            timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsProcessing(true);

        // 2. Build Dynamic Context based on Permissions
        const context: any = {
            clinic: { name: settings.name, location: settings.location },
            user: { name: user.name, role: user.role },
            today: new Date().toLocaleDateString(),
        };

        if (aiConfig.accessInventory) {
            context.inventory = inventory.map(i => ({ id: i.id, name: i.name, stock: i.stock, unit: i.unit, location: 'Pharmacy' }));
        }
        if (aiConfig.accessAppointments) {
            context.appointments = appointments.filter(a => a.status === 'Scheduled').map(a => ({ id: a.id, patient: a.patientName, time: a.time, reason: a.reason }));
        }
        if (aiConfig.accessPatients) {
            context.patients = patients.map(p => ({
                id: p.id,
                name: p.name,
                age: p.age,
                phone: p.phone,
                gender: p.gender,
                lastVisit: p.lastVisit,
                notes: p.notes
            }));
        }
        if (aiConfig.accessStaff) {
            context.staff = team.map(t => ({ name: t.name, role: t.role, status: t.status }));
        }

        // 3. AI Processing
        try {
            const aiResponse = await getStaffAssistantResponse(userMsg.text, context);

            // Add Bot Reply
            if (aiResponse.reply) {
                const botMsg: ChatMessage = {
                    id: (Date.now() + 1).toString(),
                    sender: 'bot',
                    text: aiResponse.reply,
                    timestamp: new Date().toISOString()
                };
                setMessages(prev => [...prev, botMsg]);
            }

            // Handle Action via server-side handler
            if (aiResponse.action) {
                const resultMsg = await executeAction(aiResponse.action);
                if (resultMsg) {
                    const sysMsg: ChatMessage = {
                        id: (Date.now() + 2).toString(),
                        sender: 'system',
                        text: resultMsg,
                        timestamp: new Date().toISOString(),
                        isAction: true
                    };
                    setMessages(prev => [...prev, sysMsg]);
                }
            }

            // Log
            const newLog: LogEntry = {
                id: `L-${Date.now()}`,
                timestamp: new Date().toISOString(),
                user: user.name,
                query: userMsg.text,
                response: aiResponse.reply || 'Action executed',
                status: 'Success'
            };
            setLogs(prev => [newLog, ...prev]);

        } catch (err) {
            setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'system', text: 'Error connecting to AI service.', timestamp: new Date().toISOString() }]);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTestConnection = () => {
        if (!connectionConfig.phoneId || !connectionConfig.accessToken) {
            showToast('Please enter both ID and Token fields.', 'error');
            return;
        }

        setIsTestingConnection(true);
        setTimeout(() => {
            setIsTestingConnection(false);
            showToast('Connection Successful! Verified with Provider.', 'success');
        }, 2000);
    };

    const handleCopyWebhook = () => {
        navigator.clipboard.writeText(connectionConfig.webhookUrl);
        showToast('Webhook URL copied to clipboard', 'success');
    };

    const handleSaveConfig = () => {
        updateSettings({
            ...settings,
            whatsappConfig: {
                enabled: botStatus === 'Active',
                provider: connectionConfig.provider as "Meta" | "Twilio",
                phoneId: connectionConfig.phoneId,
                accessToken: connectionConfig.accessToken,
                webhookUrl: connectionConfig.webhookUrl,
                persona: aiConfig.persona,
                capabilities: {
                    inventory: aiConfig.accessInventory,
                    appointments: aiConfig.accessAppointments,
                    patients: aiConfig.accessPatients,
                    staff: aiConfig.accessStaff
                }
            }
        });
        showToast('Agent configuration saved successfully.', 'success');
    };

    // --- RENDERERS ---

    const renderPlayground = () => (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px] animate-in fade-in slide-in-from-bottom-4">
            {/* Controls Sidebar */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col">
                <div className="mb-6">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Terminal className="w-5 h-5 text-indigo-600" /> Simulator
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Test the agent as different staff members.</p>
                </div>

                <div className="space-y-6 flex-1">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Simulate User</label>
                        <select
                            value={selectedTestUser}
                            onChange={(e) => setSelectedTestUser(e.target.value)}
                            className="w-full p-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none dark:text-white"
                        >
                            {team.map(t => <option key={t.id} value={t.id}>{t.name} ({t.role})</option>)}
                        </select>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Agent Status</span>
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase ${botStatus === 'Active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                <div className={`w-2 h-2 rounded-full ${botStatus === 'Active' ? 'bg-green-50 animate-pulse' : 'bg-amber-500'}`}></div>
                                {botStatus}
                            </div>
                        </div>
                        <button
                            onClick={() => setBotStatus(botStatus === 'Active' ? 'Paused' : 'Active')}
                            className="w-full py-2 text-xs font-bold bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-500 transition-colors"
                        >
                            {botStatus === 'Active' ? 'Pause Agent' : 'Activate Agent'}
                        </button>
                    </div>

                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                        <h4 className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-2 flex items-center gap-1">
                            <Brain className="w-3 h-3" /> Active Context
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {aiConfig.accessInventory && <span className="text-[10px] bg-white dark:bg-indigo-900/40 px-2 py-1 rounded border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300">Inventory</span>}
                            {aiConfig.accessAppointments && <span className="text-[10px] bg-white dark:bg-indigo-900/40 px-2 py-1 rounded border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300">Schedule</span>}
                            {aiConfig.accessPatients && <span className="text-[10px] bg-white dark:bg-indigo-900/40 px-2 py-1 rounded border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300">Patients</span>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Chat Interface */}
            <div className="lg:col-span-2 bg-slate-100 dark:bg-slate-900 rounded-3xl shadow-inner flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">
                <div className="p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shadow-sm z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center text-green-600">
                            <Bot className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white">JuaAfya Ops Bot</h4>
                            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                                {isProcessing ? 'Analyzing clinic data...' : 'Online'}
                            </p>
                        </div>
                    </div>
                    <button onClick={() => setMessages([])} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors" title="Clear Chat History">
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>

                <div
                    className="flex-1 overflow-y-auto p-6 space-y-4"
                    style={{
                        backgroundImage: 'radial-gradient(#00000010 1px, transparent 1px)',
                        backgroundSize: '20px 20px',
                        backgroundColor: activeTab === 'playground' ? (document.documentElement.classList.contains('dark') ? '#0b141a' : '#e5ddd5') : 'transparent'
                    }}
                >
                    {messages.map((msg, idx) => (
                        <div key={msg.id || idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-xl shadow-sm text-sm relative ${msg.sender === 'user'
                                ? 'bg-[#dcf8c6] dark:bg-[#056162] text-slate-900 dark:text-white rounded-tr-none'
                                : msg.sender === 'system'
                                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-800 dark:text-blue-100 border border-blue-100 dark:border-blue-800 rounded-lg text-center text-xs w-full mb-2 font-bold'
                                    : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-tl-none'
                                }`}>
                                {msg.isAction && <Zap className="w-3 h-3 inline mr-1 text-blue-500" />}
                                {msg.text}
                                <div className={`text-[9px] mt-1 text-right opacity-60 ${msg.sender === 'system' ? 'hidden' : ''}`}>
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    ))}
                    {isProcessing && (
                        <div className="flex justify-start">
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl rounded-tl-none shadow-sm flex items-center gap-2">
                                <div className="flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex gap-2">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Type a message..."
                            className="flex-1 p-3 bg-slate-100 dark:bg-slate-700 border-none rounded-xl outline-none focus:ring-2 focus:ring-green-500 dark:text-white"
                            disabled={isProcessing || botStatus === 'Paused'}
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={!input.trim() || isProcessing || botStatus === 'Paused'}
                            className="p-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors shadow-lg shadow-green-200 dark:shadow-none"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderBrain = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <Database className="w-6 h-6 text-indigo-600" /> Data Capabilities
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                    Select which clinic data the AI Agent can access to answer queries. This integrates the bot directly with your live system.
                </p>

                <div className="space-y-4">
                    {[
                        { id: 'accessInventory', label: 'Inventory & Stock', desc: 'Allow checking medicine availability and expiration dates.' },
                        { id: 'accessAppointments', label: 'Appointment Schedule', desc: 'Allow checking doctor availability and patient queues.' },
                        { id: 'accessPatients', label: 'Patient Records', desc: 'Allow lookup of patient history and biometrics (Restricted).' },
                        { id: 'accessStaff', label: 'Staff Directory', desc: 'Allow finding contact details of other team members.' },
                    ].map((item) => (
                        <div key={item.id} className="flex items-start gap-4 p-4 border border-slate-100 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                            <input
                                type="checkbox"
                                checked={(aiConfig as any)[item.id]}
                                onChange={(e) => setAiConfig({ ...aiConfig, [item.id]: e.target.checked })}
                                className="mt-1 w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                            />
                            <div>
                                <label className="font-bold text-slate-900 dark:text-white text-sm cursor-pointer block">{item.label}</label>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-purple-600" /> Agent Persona
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                    Define how the AI should communicate with your staff.
                </p>

                <div className="mb-8">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 block">Tone of Voice</label>
                    <div className="grid grid-cols-3 gap-3">
                        {['Professional', 'Friendly', 'Urgent'].map(mode => (
                            <button
                                key={mode}
                                onClick={() => setAiConfig({ ...aiConfig, persona: mode })}
                                className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${aiConfig.persona === mode
                                    ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                                    : 'border-slate-100 dark:border-slate-700 text-slate-500 hover:border-purple-200'
                                    }`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-100 dark:border-slate-700">
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-2">Preview Instruction</h4>
                    <p className="text-xs font-mono text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-600">
                        "You are the JuaAfya Operations Assistant. Your tone is {aiConfig.persona.toUpperCase()}.
                        You have access to: {aiConfig.accessInventory ? 'Inventory, ' : ''}{aiConfig.accessAppointments ? 'Schedule, ' : ''}...
                        Keep responses concise and actionable for mobile reading."
                    </p>
                </div>

                <div className="mt-8 flex justify-end">
                    <button
                        onClick={handleSaveConfig}
                        className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" /> Save Configuration
                    </button>
                </div>
            </div>
        </div>
    );

    const renderConnection = () => (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Provider Connection</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Connect your business number via Meta or Twilio API.</p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-xl flex">
                    {(['Meta', 'Twilio'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => setConnectionConfig({ ...connectionConfig, provider: p })}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${connectionConfig.provider === p ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                            {connectionConfig.provider === 'Meta' ? 'Phone Number ID' : 'Account SID'}
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="password"
                                value={connectionConfig.phoneId}
                                onChange={(e) => setConnectionConfig({ ...connectionConfig, phoneId: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                                placeholder={connectionConfig.provider === 'Meta' ? 'e.g. 1000832...' : 'e.g. AC823...'}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                            {connectionConfig.provider === 'Meta' ? 'Access Token' : 'Auth Token'}
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="password"
                                value={connectionConfig.accessToken}
                                onChange={(e) => setConnectionConfig({ ...connectionConfig, accessToken: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                                placeholder={connectionConfig.provider === 'Meta' ? 'e.g. EAA...' : 'e.g. 71d9...'}
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleTestConnection}
                        disabled={isTestingConnection}
                        className="w-full py-3 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 shadow-lg shadow-teal-200 dark:shadow-none transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isTestingConnection ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Test Connection'}
                    </button>
                </div>

                <div className="p-6 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-200 dark:border-slate-600">
                    <h4 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <Wifi className="w-5 h-5 text-indigo-600" /> Webhook Setup
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                        Copy this URL to your provider's dashboard to receive incoming messages.
                    </p>
                    <div className="flex gap-2">
                        <input
                            readOnly
                            value={connectionConfig.webhookUrl}
                            className="flex-1 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-mono text-slate-600 dark:text-slate-300"
                        />
                        <button
                            onClick={handleCopyWebhook}
                            className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700"
                            title="Copy"
                        >
                            <Copy className="w-4 h-4 text-slate-500" />
                        </button>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        <span className="text-xs font-bold text-red-500">Webhook Disconnected</span>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderLogs = () => {
        const filteredLogs = logs.filter(l =>
            l.user.toLowerCase().includes(logSearch.toLowerCase()) ||
            l.query.toLowerCase().includes(logSearch.toLowerCase()) ||
            l.response.toLowerCase().includes(logSearch.toLowerCase())
        );

        return (
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h3 className="font-bold text-slate-900 dark:text-white">Interaction History</h3>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                placeholder="Search logs..."
                                value={logSearch}
                                onChange={(e) => setLogSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-700 rounded-xl text-sm outline-none dark:text-white"
                            />
                        </div>
                        <button onClick={() => setLogs([])} className="text-xs text-red-500 font-bold hover:underline whitespace-nowrap">Clear Logs</button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs uppercase text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-700">
                            <tr>
                                <th className="px-6 py-4">Time</th>
                                <th className="px-6 py-4">User</th>
                                <th className="px-6 py-4">Query</th>
                                <th className="px-6 py-4">Response</th>
                                <th className="px-6 py-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                            {filteredLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                    <td className="px-6 py-4 text-slate-500 text-xs font-mono whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString()}</td>
                                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{log.user}</td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 max-w-[200px] truncate" title={log.query}>"{log.query}"</td>
                                    <td className="px-6 py-4 text-slate-500 max-w-[250px] truncate" title={log.response}>{log.response}</td>
                                    <td className="px-6 py-4">
                                        <span className={`text-xs font-bold px-2 py-1 rounded ${log.status === 'Success'
                                            ? 'text-green-600 bg-green-50 dark:bg-green-900/20'
                                            : 'text-red-600 bg-red-50 dark:bg-red-900/20'
                                            }`}>
                                            {log.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {filteredLogs.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">No logs found.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 md:p-10 bg-gray-50 dark:bg-slate-900 min-h-screen transition-colors duration-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <MessageSquare className="w-8 h-8 text-green-600" /> WhatsApp Agent
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">AI-powered assistant for clinic operations.</p>
                </div>

                <div className="flex bg-white dark:bg-slate-800 p-1.5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto">
                    {[
                        { id: 'playground', label: 'Playground', icon: Terminal },
                        { id: 'brain', label: 'AI Brain', icon: Brain },
                        { id: 'connection', label: 'Connection', icon: LinkIcon },
                        { id: 'logs', label: 'Logs', icon: Activity },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as AgentTab)}
                            className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === tab.id
                                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="min-h-[500px]">
                {activeTab === 'playground' && renderPlayground()}
                {activeTab === 'brain' && renderBrain()}
                {activeTab === 'connection' && renderConnection()}
                {activeTab === 'logs' && renderLogs()}
            </div>

            {/* Toast Notification */}
            {toast && (
                <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-bottom-5 z-[70] ${toast.type === 'success' ? 'bg-white dark:bg-slate-800 border-green-500 text-green-600' :
                    'bg-white dark:bg-slate-800 border-red-500 text-red-600'
                    }`}>
                    {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <span className="font-bold text-sm">{toast.message}</span>
                </div>
            )}
        </div>
    );
};

export default WhatsAppAgent;

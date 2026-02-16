"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
    LifeBuoy,
    Search,
    Plus,
    MessageSquare,
    Clock,
    CheckCircle,
    AlertCircle,
    Send,
    Loader2,
    ChevronRight,
    ArrowLeft,
    Paperclip,
    Smile
} from "lucide-react"
import { db } from "../services/db"
import useStore from "../store"
import { SupportTicket } from "../types"
import { isSuperAdmin } from "../lib/rbac"

const HelpDesk: React.FC = () => {
    const currentUser = useStore(state => state.currentUser)
    const [tickets, setTickets] = useState<SupportTicket[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isCreating, setIsCreating] = useState(false)
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState<'All' | 'Open' | 'In Progress' | 'Resolved'>('All')

    // Form state for new ticket
    const [newTicket, setNewTicket] = useState({
        subject: "",
        priority: "Medium" as const,
        message: ""
    })

    const [replyText, setReplyText] = useState("")
    const [isProcessing, setIsProcessing] = useState(false)
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null)

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000)
            return () => clearTimeout(timer)
        }
    }, [toast])

    const fetchTickets = useCallback(async () => {
        if (!currentUser) return
        setIsLoading(true)
        try {
            // Clinic Admins can only see their own tickets
            const clinicIdFilter = isSuperAdmin(currentUser.role) ? undefined : currentUser.clinicId
            const data = await db.getSupportTickets(clinicIdFilter)
            setTickets(data)
        } catch (error) {
            console.error("Failed to fetch tickets:", error)
        } finally {
            setIsLoading(false)
        }
    }, [currentUser])

    useEffect(() => {
        fetchTickets()
    }, [fetchTickets])

    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newTicket.subject.trim() || !newTicket.message.trim() || !currentUser?.clinicId) return

        setIsProcessing(true)
        try {
            const ticketData = {
                clinicId: currentUser.clinicId,
                userId: currentUser.id,
                subject: newTicket.subject,
                priority: newTicket.priority,
                messages: [{
                    role: 'user',
                    content: newTicket.message,
                    timestamp: new Date().toISOString(),
                    author: currentUser.name
                }]
            }
            await db.createSupportTicket(ticketData as any)
            setIsCreating(false)
            setNewTicket({ subject: "", priority: "Medium", message: "" })
            fetchTickets()
            setToast({ message: "Ticket created successfully", type: "success" })
        } catch (error) {
            console.error("Failed to create ticket:", error)
            setToast({ message: "Failed to create ticket", type: "error" })
        } finally {
            setIsProcessing(false)
        }
    }

    const handleSendReply = async () => {
        if (!selectedTicket || !replyText.trim() || !currentUser) return

        setIsProcessing(true)
        try {
            const newMessage = {
                role: 'user',
                content: replyText,
                timestamp: new Date().toISOString(),
                author: currentUser.name
            }

            const updatedMessages = [...(selectedTicket.messages || []), newMessage]
            await db.updateSupportTicket(selectedTicket.id, {
                messages: updatedMessages,
                status: 'Open' // Reopen or set to open if it was resolved/pending
            })

            const updatedTicket = { ...selectedTicket, messages: updatedMessages, status: 'Open' as const }
            setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t))
            setSelectedTicket(updatedTicket)
            setReplyText("")
        } catch (error) {
            console.error("Failed to send reply:", error)
            setToast({ message: "Failed to send message", type: "error" })
        } finally {
            setIsProcessing(false)
        }
    }

    const filteredTickets = tickets.filter(t => {
        const matchesSearch = t.subject.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesStatus = statusFilter === 'All' || t.status === statusFilter
        return matchesSearch && matchesStatus
    })

    const renderTicketList = () => (
        <div className="flex flex-col h-full">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Help Desk</h2>
                        <p className="text-sm text-slate-500 mt-1">Get support from the JuaAfya team</p>
                    </div>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-100 dark:shadow-none transition-all"
                    >
                        <Plus className="w-4 h-4" /> New Ticket
                    </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search tickets..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {['All', 'Open', 'In Progress', 'Resolved'].map(status => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status as any)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${statusFilter === status
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-100 dark:border-slate-700 hover:border-indigo-300'
                                    }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white/50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
                        <p className="text-slate-500 text-sm font-medium">Loading your tickets...</p>
                    </div>
                ) : filteredTickets.length > 0 ? (
                    filteredTickets.map(ticket => (
                        <div
                            key={ticket.id}
                            onClick={() => setSelectedTicket(ticket)}
                            className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/5 transition-all cursor-pointer group"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${ticket.priority === 'Critical' || ticket.priority === 'High' ? 'bg-rose-50 text-rose-600' :
                                        ticket.priority === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'
                                        }`}>
                                        {ticket.priority}
                                    </span>
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${ticket.status === 'Open' ? 'bg-indigo-50 text-indigo-600' :
                                        ticket.status === 'In Progress' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                                        }`}>
                                        {ticket.status}
                                    </span>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400">{ticket.dateCreated}</span>
                            </div>
                            <h4 className="font-bold text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 transition-colors">{ticket.subject}</h4>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500 line-clamp-1 flex-1 pr-4">
                                    {ticket.messages && ticket.messages.length > 0 ? ticket.messages[ticket.messages.length - 1].content : "No messages"}
                                </span>
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                            <LifeBuoy className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">No tickets found</h3>
                        <p className="text-slate-500 text-sm mt-1 max-w-[240px] text-center">
                            Need help? Create a support ticket and our team will get back to you.
                        </p>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="mt-6 text-indigo-600 font-bold text-sm hover:underline"
                        >
                            Create your first ticket
                        </button>
                    </div>
                )}
            </div>
        </div>
    )

    const renderCreateForm = () => (
        <div className="p-8 h-full flex flex-col">
            <button
                onClick={() => setIsCreating(false)}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white mb-8 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" /> Back to Tickets
            </button>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Create New Ticket</h2>
            <p className="text-slate-500 mb-8">Tell us what's on your mind and we'll help you out.</p>

            <form onSubmit={handleCreateTicket} className="space-y-6 max-w-2xl">
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Subject</label>
                    <input
                        type="text"
                        required
                        value={newTicket.subject}
                        onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                        placeholder="e.g. Issue with SMS delivery"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-sm"
                    />
                </div>

                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Priority</label>
                    <div className="grid grid-cols-3 gap-3">
                        {['Low', 'Medium', 'High'].map(p => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setNewTicket({ ...newTicket, priority: p as any })}
                                className={`py-3 rounded-2xl text-xs font-bold border transition-all ${newTicket.priority === p
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100 dark:shadow-none'
                                    : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-100 dark:border-slate-700 hover:border-indigo-300'
                                    }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Describe the issue</label>
                    <textarea
                        required
                        rows={6}
                        value={newTicket.message}
                        onChange={(e) => setNewTicket({ ...newTicket, message: e.target.value })}
                        placeholder="Please provide as much detail as possible..."
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-sm resize-none"
                    />
                </div>

                <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-4 rounded-2xl font-bold shadow-xl shadow-indigo-100 dark:shadow-none transition-all flex items-center justify-center gap-2"
                >
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
                    Submit Ticket
                </button>
            </form>
        </div>
    )

    const renderTicketDetail = () => {
        if (!selectedTicket) return null

        return (
            <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-10">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSelectedTicket(null)}
                            className="bg-slate-50 dark:bg-slate-800 p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all sm:hidden"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white line-clamp-1">{selectedTicket.subject}</h3>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                <span>Ticket #{selectedTicket.id.substring(0, 8)}</span>
                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                <span>Started {selectedTicket.dateCreated}</span>
                            </div>
                        </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${selectedTicket.status === 'Open' ? 'bg-indigo-50 text-indigo-600' :
                        selectedTicket.status === 'In Progress' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                        {selectedTicket.status}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-800/20">
                    {selectedTicket.messages?.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'admin' ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[85%] rounded-[2rem] p-5 shadow-sm ${msg.role === 'admin'
                                ? 'bg-white dark:bg-slate-800 rounded-tl-none border border-slate-100 dark:border-slate-700'
                                : 'bg-indigo-600 text-white rounded-tr-none'
                                }`}>
                                <div className="flex items-center justify-between gap-4 mb-2">
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${msg.role === 'admin' ? 'text-indigo-600' : 'text-indigo-100'}`}>
                                        {msg.role === 'admin' ? 'Support Hero' : 'You'}
                                    </span>
                                    <span className={`text-[9px] font-bold ${msg.role === 'admin' ? 'text-slate-400' : 'text-indigo-200'}`}>
                                        {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                    </span>
                                </div>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {selectedTicket.status !== 'Resolved' && (
                    <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-end gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                            <button className="p-2 text-slate-400 hover:text-indigo-500 transition-colors">
                                <Paperclip className="w-5 h-5" />
                            </button>
                            <textarea
                                rows={1}
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault()
                                        handleSendReply()
                                    }
                                }}
                                placeholder="Type your message..."
                                className="flex-1 bg-transparent border-none outline-none text-sm dark:text-white py-2 max-h-32 resize-none"
                                style={{ height: 'auto' }}
                            />
                            <button className="p-2 text-slate-400 hover:text-indigo-500 transition-colors">
                                <Smile className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleSendReply}
                                disabled={isProcessing || !replyText.trim()}
                                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all"
                            >
                                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-400 text-center mt-3 font-bold uppercase tracking-widest">
                            Press Enter to send message
                        </p>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="flex h-[calc(100vh-2rem)] bg-slate-50 dark:bg-slate-900 rounded-[2.5rem] overflow-hidden border border-slate-200 dark:border-slate-800 m-4 shadow-2xl">
            <div className={`w-full ${selectedTicket ? 'hidden lg:block lg:w-96 xl:w-[450px]' : ''} h-full bg-white dark:bg-slate-900 shrink-0`}>
                {isCreating ? renderCreateForm() : renderTicketList()}
            </div>

            <div className={`flex-1 h-full min-w-0 ${!selectedTicket ? 'hidden lg:flex items-center justify-center bg-slate-50 dark:bg-slate-900/50' : ''}`}>
                {selectedTicket ? renderTicketDetail() : (
                    <div className="text-center p-12">
                        <div className="w-24 h-24 bg-white dark:bg-slate-800 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-slate-200/50 dark:shadow-none">
                            <MessageSquare className="w-10 h-10 text-indigo-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Select a ticker to view conversation</h3>
                        <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
                            Our support experts are ready to help you with any technical or billing questions.
                        </p>
                    </div>
                )}
            </div>
            {/* Toast Notification */}
            {toast && (
                <div className={`fixed bottom-10 right-10 px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-bottom-5 z-[100] ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-rose-50 border-rose-200 text-rose-600'
                    }`}>
                    {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <span className="font-bold text-sm">{toast.message}</span>
                </div>
            )}
        </div>
    )
}

export default HelpDesk

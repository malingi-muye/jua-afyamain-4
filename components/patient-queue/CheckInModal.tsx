"use client"

import React, { memo } from "react"
import { X, Search, Plus } from "lucide-react"
import type { Patient, VisitPriority } from "../../types"

interface CheckInModalProps {
    isOpen: boolean
    onClose: () => void
    searchTerm: string
    setSearchTerm: (val: string) => void
    deferredSearchTerm: string
    priority: VisitPriority
    setPriority: (val: VisitPriority) => void
    skipVitals: boolean
    setSkipVitals: (val: boolean) => void
    patients: Patient[]
    onCheckIn: (patientId: string) => void
}

const CheckInModal: React.FC<CheckInModalProps> = ({
    isOpen,
    onClose,
    searchTerm,
    setSearchTerm,
    deferredSearchTerm,
    priority,
    setPriority,
    skipVitals,
    setSkipVitals,
    patients,
    onCheckIn
}) => {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Patient Check-In</h3>
                    <button onClick={onClose}>
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        autoFocus
                        placeholder="Search name or phone..."
                        className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-700 rounded-xl border-none outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="mb-4">
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Visit Priority</label>
                    <select
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 rounded-xl outline-none dark:text-white text-sm font-medium"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as VisitPriority)}
                    >
                        <option value="Normal">Normal</option>
                        <option value="Urgent">Urgent</option>
                        <option value="Emergency">Emergency</option>
                    </select>
                </div>

                <div className="mb-6 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl flex items-center gap-3">
                    <input
                        type="checkbox"
                        id="skipVitals"
                        checked={skipVitals}
                        onChange={(e) => setSkipVitals(e.target.checked)}
                        className="w-5 h-5 text-teal-600 rounded cursor-pointer"
                    />
                    <label htmlFor="skipVitals" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                        Skip Vitals (Direct to Doctor)
                    </label>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-2 border-t border-slate-100 dark:border-slate-700 pt-4">
                    <p className="text-xs font-bold text-slate-400 mb-2">Select Patient to Queue:</p>
                    {patients
                        .filter((p) => p.name.toLowerCase().includes(deferredSearchTerm.toLowerCase()) || p.phone.includes(deferredSearchTerm))
                        .slice(0, 5)
                        .map((patient) => (
                            <div
                                key={patient.id}
                                className="flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700 transition-colors cursor-pointer"
                                onClick={() => onCheckIn(patient.id)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xs">
                                        {patient.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-900 dark:text-white text-sm">{patient.name}</div>
                                        <div className="text-xs text-slate-500">{patient.phone}</div>
                                    </div>
                                </div>
                                <Plus className="w-5 h-5 text-teal-600" />
                            </div>
                        ))}
                    {searchTerm && patients.filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.phone.includes(searchTerm)).length === 0 && (
                        <p className="text-center py-4 text-xs text-slate-400 italic">No patients found matches "{searchTerm}"</p>
                    )}
                </div>
            </div>
        </div>
    )
}

export default memo(CheckInModal)

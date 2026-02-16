"use client"

import React, { memo } from "react"
import { Clock, ArrowRight, AlertTriangle } from "lucide-react"
import type { Visit, VisitStage, VisitPriority } from "../../types"
import { getWaitTime } from "../../lib/utils"

interface VisitCardProps {
    visit: Visit
    activeStage: VisitStage
    onSelect: (visit: Visit) => void
    calculateTotal: (visit: Visit) => number
    getPriorityColor: (p: VisitPriority) => string
}

const VisitCard: React.FC<VisitCardProps> = ({
    visit,
    activeStage,
    onSelect,
    calculateTotal,
    getPriorityColor
}) => {
    return (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex justify-between items-start mb-3">
                <div
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase flex items-center gap-1 ${getPriorityColor(visit.priority)}`}
                >
                    {visit.priority === "Emergency" && <AlertTriangle className="w-3 h-3" />}
                    {visit.priority}
                </div>
                <div className="text-[10px] font-mono font-bold text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {getWaitTime(visit.stageStartTime)}
                </div>
            </div>

            <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-1">{visit.patientName}</h4>
            <p className="text-xs text-slate-500 mb-3 truncate">ID: {visit.patientId}</p>

            <div className="space-y-2 mb-4">
                {visit.stage === "Vitals" && !visit.vitals && (
                    <div className="text-xs text-orange-600 font-bold bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded w-fit">
                        Waiting Vitals
                    </div>
                )}
                {visit.stage === "Consultation" && (
                    <div className="flex gap-2 text-xs">
                        <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                            BP: {visit.vitals?.bp || "--"}
                        </span>
                        <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                            Temp: {visit.vitals?.temp || "--"}
                        </span>
                    </div>
                )}
                {visit.stage === "Lab" && (
                    <div className="text-xs text-indigo-600 font-bold bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded w-fit">
                        {visit.labOrders.filter((o) => o.status === "Pending").length} Pending Tests
                    </div>
                )}
                {visit.stage === "Billing" && (
                    <div className="text-sm font-bold text-green-600">
                        Total: KSh {visit.totalBill || calculateTotal(visit)}
                    </div>
                )}
            </div>

            {activeStage !== "Pharmacy" && activeStage !== "Completed" && (
                <button
                    onClick={() => onSelect(visit)}
                    className="w-full py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                    {activeStage === "Check-In"
                        ? "Review & Route"
                        : activeStage === "Vitals"
                            ? "Record Vitals"
                            : activeStage === "Consultation"
                                ? "Open Chart"
                                : activeStage === "Lab"
                                    ? "Enter Results"
                                    : activeStage === "Billing"
                                        ? "Process Payment"
                                        : activeStage === "Clearance"
                                            ? "Process Exit"
                                            : "Manage"}
                    <ArrowRight className="w-3.5 h-3.5" />
                </button>
            )}

            {activeStage === "Pharmacy" && (
                <div className="text-center text-xs font-bold text-purple-600 bg-purple-50 dark:bg-purple-900/20 py-2 rounded-xl border border-purple-100 dark:border-purple-800">
                    {visit.medicationsDispensed ? "Ready for Clearance" : "Dispense in Pharmacy Module"}
                </div>
            )}
        </div>
    )
}

export default memo(VisitCard)

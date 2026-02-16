"use client"

import React, { useState, memo } from "react"
import { Activity, X, Stethoscope, FlaskConical, Pill, ArrowRight, Printer, CheckCircle, Receipt, RefreshCw, CreditCard, QrCode, LogOut, AlertTriangle, BriefcaseMedical } from "lucide-react"
import type { Visit, Patient, VisitStage, InventoryItem, LabTestProfile, PrescriptionItem, LabOrder } from "../../types"

interface ActionModalProps {
    visit: Visit
    activeStage: VisitStage
    patients: Patient[]
    inventory: InventoryItem[]
    labTests: LabTestProfile[]
    onClose: () => void
    onUpdateDraft: (visit: Visit) => void
    onStageChange: (visit: Visit, nextStage: VisitStage) => void
    calculateTotal: (visit: Visit) => number
    onPaymentModalOpen?: () => void
    onCompleteVisit?: (visit: Visit) => void
}

const ActionModal: React.FC<ActionModalProps> = ({
    visit: selectedVisit,
    activeStage,
    patients,
    inventory,
    labTests,
    onClose,
    onUpdateDraft,
    onStageChange,
    calculateTotal,
    onPaymentModalOpen,
    onCompleteVisit
}) => {
    const [doctorTab, setDoctorTab] = useState<"Clinical" | "Orders" | "History">("Clinical")
    const patient = patients.find((p) => p.id === selectedVisit.patientId)

    // --- VITALS FORM helper ---
    const updateVitals = (key: keyof NonNullable<Visit['vitals']>, value: string) => {
        onUpdateDraft({
            ...selectedVisit,
            vitals: { ...selectedVisit.vitals!, [key]: value }
        })
    }

    // --- DOCTOR FORM helpers ---
    const addToPrescription = (item: InventoryItem) => {
        const newItem: PrescriptionItem = {
            inventoryId: item.id,
            name: item.name,
            dosage: "1x2 for 3 days",
            quantity: 1,
            price: item.price,
        }
        onUpdateDraft({
            ...selectedVisit,
            prescription: [...selectedVisit.prescription, newItem],
        })
    }

    const addToLabs = (test: LabTestProfile) => {
        const newOrder: LabOrder = {
            id: `LO-${Date.now()}`,
            testId: test.id,
            testName: test.name,
            price: test.price,
            status: "Pending",
            orderedAt: new Date().toISOString(),
        }
        onUpdateDraft({
            ...selectedVisit,
            labOrders: [...selectedVisit.labOrders, newOrder],
        })
    }

    // --- VITALS FORM ---
    if (activeStage === "Vitals") {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-orange-500" /> Vitals Check: {selectedVisit.patientName}
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Blood Pressure</label>
                            <input
                                className="w-full p-3 bg-slate-50 dark:bg-slate-700 rounded-xl mt-1 outline-none dark:text-white"
                                placeholder="120/80"
                                value={selectedVisit.vitals?.bp || ""}
                                onChange={(e) => updateVitals('bp', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Temp (°C)</label>
                            <input
                                className="w-full p-3 bg-slate-50 dark:bg-slate-700 rounded-xl mt-1 outline-none dark:text-white"
                                placeholder="36.5"
                                value={selectedVisit.vitals?.temp || ""}
                                onChange={(e) => updateVitals('temp', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Weight (kg)</label>
                            <input
                                className="w-full p-3 bg-slate-50 dark:bg-slate-700 rounded-xl mt-1 outline-none dark:text-white"
                                placeholder="70"
                                value={selectedVisit.vitals?.weight || ""}
                                onChange={(e) => updateVitals('weight', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Height (cm)</label>
                            <input
                                className="w-full p-3 bg-slate-50 dark:bg-slate-700 rounded-xl mt-1 outline-none dark:text-white"
                                placeholder="170"
                                value={selectedVisit.vitals?.height || ""}
                                onChange={(e) => updateVitals('height', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Pulse Rate (bpm)</label>
                            <input
                                className="w-full p-3 bg-slate-50 dark:bg-slate-700 rounded-xl mt-1 outline-none dark:text-white"
                                placeholder="72"
                                value={selectedVisit.vitals?.heartRate || ""}
                                onChange={(e) => updateVitals('heartRate', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Resp Rate (cpm)</label>
                            <input
                                className="w-full p-3 bg-slate-50 dark:bg-slate-700 rounded-xl mt-1 outline-none dark:text-white"
                                placeholder="18"
                                value={selectedVisit.vitals?.respRate || ""}
                                onChange={(e) => updateVitals('respRate', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">SPO2 (%)</label>
                            <input
                                className="w-full p-3 bg-slate-50 dark:bg-slate-700 rounded-xl mt-1 outline-none dark:text-white"
                                placeholder="98"
                                value={selectedVisit.vitals?.spo2 || ""}
                                onChange={(e) => updateVitals('spo2', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">BMI</label>
                            <div className="w-full p-3 bg-slate-100 dark:bg-slate-900 rounded-xl mt-1 dark:text-slate-400 font-bold">
                                {(() => {
                                    const w = parseFloat(selectedVisit.vitals?.weight || "0")
                                    const h = parseFloat(selectedVisit.vitals?.height || "0") / 100
                                    if (w > 0 && h > 0) return (w / (h * h)).toFixed(1)
                                    return "--"
                                })()}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button onClick={onClose} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl">Cancel</button>
                        <button onClick={() => onStageChange(selectedVisit, "Consultation")} className="flex-1 py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600">Save & Send to Doctor</button>
                    </div>
                </div>
            </div>
        )
    }

    // --- DOCTOR FORM ---
    if (activeStage === "Consultation") {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white dark:bg-slate-800 w-full max-w-4xl rounded-2xl p-0 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh] overflow-hidden">
                    {/* Header */}
                    <div className="p-6 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{selectedVisit.patientName}</h3>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${selectedVisit.priority === "Emergency" ? "bg-red-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>{selectedVisit.priority}</span>
                        </div>
                        <button onClick={onClose}><X className="w-6 h-6 text-slate-400" /></button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-slate-200 dark:border-slate-700 px-6">
                        {["Clinical", "Orders", "History"].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setDoctorTab(tab as any)}
                                className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${doctorTab === tab ? "border-teal-600 text-teal-600 dark:text-teal-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-800">
                        {doctorTab === "Clinical" && (
                            <div className="space-y-6 animate-in fade-in">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">BP</span>
                                        <span className="text-sm font-bold dark:text-white">{selectedVisit.vitals?.bp || '--'}</span>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Temp</span>
                                        <span className="text-sm font-bold dark:text-white">{selectedVisit.vitals?.temp ? `${selectedVisit.vitals.temp}°C` : '--'}</span>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Weight</span>
                                        <span className="text-sm font-bold dark:text-white">{selectedVisit.vitals?.weight ? `${selectedVisit.vitals.weight}kg` : '--'}</span>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">SPO2</span>
                                        <span className="text-sm font-bold dark:text-white">{selectedVisit.vitals?.spo2 ? `${selectedVisit.vitals.spo2}%` : '--'}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Chief Complaint</label>
                                    <textarea
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-700 rounded-xl mt-1 outline-none dark:text-white text-sm"
                                        rows={2}
                                        value={selectedVisit.chiefComplaint || ""}
                                        onChange={(e) => onUpdateDraft({ ...selectedVisit, chiefComplaint: e.target.value })}
                                        placeholder="Patient's primary symptom..."
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Diagnosis / Impression</label>
                                    <input
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-700 rounded-xl mt-1 outline-none dark:text-white text-sm font-bold"
                                        value={selectedVisit.diagnosis || ""}
                                        onChange={(e) => onUpdateDraft({ ...selectedVisit, diagnosis: e.target.value })}
                                        placeholder="e.g. Malaria, URI..."
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Detailed Doctor Notes</label>
                                    <textarea
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-700 rounded-xl mt-1 outline-none dark:text-white text-sm"
                                        rows={4}
                                        value={selectedVisit.doctorNotes || ""}
                                        onChange={(e) => onUpdateDraft({ ...selectedVisit, doctorNotes: e.target.value })}
                                        placeholder="Clinical observations..."
                                    />
                                </div>
                            </div>
                        )}

                        {doctorTab === "Orders" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in h-full">
                                {/* Labs */}
                                <div className="flex flex-col h-full">
                                    <h4 className="font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2 text-sm">
                                        <FlaskConical className="w-4 h-4 text-indigo-500" /> Lab Requests
                                    </h4>
                                    <div className="flex-1 bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4 space-y-3 border border-slate-100 dark:border-slate-700 overflow-y-auto">
                                        {selectedVisit.labOrders.map((order, idx) => (
                                            <div key={idx} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-600">
                                                <div className="flex justify-between items-start">
                                                    <span className="font-bold text-sm dark:text-white">{order.testName}</span>
                                                    <button onClick={() => onUpdateDraft({ ...selectedVisit, labOrders: selectedVisit.labOrders.filter((_, i) => i !== idx) })} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                                        {labTests.slice(0, 10).map(test => (
                                            <button key={test.id} onClick={() => addToLabs(test)} className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-xs dark:text-white">+ {test.name}</button>
                                        ))}
                                    </div>
                                </div>

                                {/* Pharmacy */}
                                <div className="flex flex-col h-full">
                                    <h4 className="font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2 text-sm">
                                        <Pill className="w-4 h-4 text-purple-500" /> Medications
                                    </h4>
                                    <div className="flex-1 bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4 space-y-3 border border-slate-100 dark:border-slate-700 overflow-y-auto">
                                        {selectedVisit.prescription.map((item, idx) => (
                                            <div key={idx} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-600">
                                                <div className="flex justify-between items-start">
                                                    <span className="font-bold text-sm dark:text-white">{item.name}</span>
                                                    <button onClick={() => onUpdateDraft({ ...selectedVisit, prescription: selectedVisit.prescription.filter((_, i) => i !== idx) })} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                                        {inventory.filter(i => i.stock > 0).slice(0, 5).map(item => (
                                            <button key={item.id} onClick={() => addToPrescription(item)} className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-xs dark:text-white">+ {item.name}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {doctorTab === "History" && (
                            <div className="space-y-4 animate-in fade-in">
                                {patient && patient.history.map((record, i) => (
                                    <div key={i} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border dark:border-slate-700">
                                        <p className="text-sm dark:text-slate-300">{record}</p>
                                    </div>
                                ))}
                                {(!patient || !patient.history.length) && <p className="text-center text-slate-400 py-10">No history found.</p>}
                            </div>
                        )}
                    </div>

                    <div className="p-6 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex gap-3">
                        <button onClick={onClose} className="px-6 py-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-white font-bold rounded-xl border dark:border-slate-600">Close</button>
                        {selectedVisit.labOrders.some(o => o.status === 'Pending') ? (
                            <button onClick={() => onStageChange(selectedVisit, "Lab")} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 flex items-center justify-center gap-2"><FlaskConical className="w-5 h-5" /> Send to Lab</button>
                        ) : (
                            <button onClick={() => onStageChange(selectedVisit, "Billing")} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 flex items-center justify-center gap-2"><CreditCard className="w-5 h-5" /> Send to Billing</button>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // --- LAB FORM ---
    if (activeStage === "Lab") {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><FlaskConical className="w-6 h-6 text-indigo-500" /> Lab Results</h3>
                        <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-6">
                        {selectedVisit.labOrders.map((order, idx) => (
                            <div key={idx} className="p-5 bg-slate-50 dark:bg-slate-700/30 rounded-xl">
                                <span className="font-bold block mb-2 dark:text-white">{order.testName}</span>
                                <input
                                    className="w-full p-3 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-xl text-sm outline-none dark:text-white font-bold"
                                    placeholder="Enter result..."
                                    value={order.result || ""}
                                    onChange={(e) => {
                                        const updated = [...selectedVisit.labOrders]
                                        updated[idx] = { ...updated[idx], result: e.target.value, status: e.target.value ? "Completed" : "Pending" }
                                        onUpdateDraft({ ...selectedVisit, labOrders: updated })
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button onClick={() => window.print()} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 font-bold rounded-xl flex items-center justify-center gap-2"><Printer className="w-5 h-5" /> Print</button>
                        <button onClick={() => onStageChange(selectedVisit, "Consultation")} className="flex-[2] py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg">Results Ready - Return to Doctor</button>
                    </div>
                </div>
            </div>
        )
    }

    // --- BILLING FORM ---
    if (activeStage === "Billing") {
        const subTotal = calculateTotal(selectedVisit)
        const grandTotal = subTotal + Math.round(subTotal * 0.16)
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="p-6 border-b dark:border-slate-700 flex justify-between bg-slate-50 dark:bg-slate-800/50">
                        <h3 className="text-xl font-bold flex items-center gap-2 dark:text-white"><CreditCard className="w-6 h-6 text-green-600" /> Billing</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="space-y-4">
                            <div className="flex justify-between font-bold dark:text-white"><span>Subtotal</span><span>KSh {subTotal.toLocaleString()}</span></div>
                            <div className="flex justify-between text-slate-500"><span>VAT (16%)</span><span>KSh {Math.round(subTotal * 0.16).toLocaleString()}</span></div>
                            <div className="flex justify-between text-2xl font-black dark:text-white border-t pt-4"><span>Total</span><span>KSh {grandTotal.toLocaleString()}</span></div>
                        </div>
                    </div>
                    <div className="p-6 border-t dark:border-slate-700 space-y-3">
                        <button onClick={onPaymentModalOpen} className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl">Pay Online</button>
                        <button onClick={() => onStageChange(selectedVisit, selectedVisit.prescription.length > 0 ? "Pharmacy" : "Clearance")} className="w-full py-4 bg-green-600 text-white font-bold rounded-xl">Mark as Paid & Continue</button>
                        <button onClick={onClose} className="w-full py-2 text-slate-400">Cancel</button>
                    </div>
                </div>
            </div>
        )
    }

    // --- CLEARANCE FORM ---
    if (activeStage === "Clearance") {
        const isPaid = selectedVisit.paymentStatus === "Paid"
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2 dark:text-white"><LogOut className="w-5 h-5" /> Clearance</h3>
                    <div className={`p-4 rounded-xl mb-6 flex items-center gap-3 border ${isPaid ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                        {isPaid ? <CheckCircle className="w-8 h-8 text-green-600" /> : <AlertTriangle className="w-8 h-8 text-amber-600" />}
                        <p className={`font-bold ${isPaid ? 'text-green-900' : 'text-amber-900'}`}>{isPaid ? 'Ready for Discharge' : 'Pending Payment'}</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 font-bold rounded-xl border">Cancel</button>
                        <button disabled={!isPaid} onClick={() => onCompleteVisit ? onCompleteVisit(selectedVisit) : onStageChange(selectedVisit, "Completed")} className={`flex-1 py-3 font-bold rounded-xl text-white ${isPaid ? 'bg-slate-900 hover:opacity-90' : 'bg-slate-200 cursor-not-allowed'}`}>Complete Visit</button>
                    </div>
                </div>
            </div>
        )
    }

    return null
}

export default memo(ActionModal)

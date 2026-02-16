"use client"

import type React from "react"
import { useState, useEffect, useMemo, useDeferredValue, startTransition, memo } from "react"
import type {
  Visit,
  Patient,
  VisitStage,
  InventoryItem,
  PrescriptionItem,
  VisitPriority,
  LabOrder,
  LabTestProfile,
} from "../types"
import {
  Users,
  Clock,
  CreditCard,
  LogOut,
  Stethoscope,
  FlaskConical,
  Activity,
  Pill,
  UserPlus
} from "lucide-react"
import useStore from '../store'
import { canCurrentUser } from '../lib/roleMapper'
import PaymentModal from './PaymentModal'

// New modular components
import VisitCard from "./patient-queue/VisitCard"
import StageTabs from "./patient-queue/StageTabs"
import CheckInModal from "./patient-queue/CheckInModal"
import ActionModal from "./patient-queue/ActionModal"

interface PatientQueueProps {
  visits: Visit[]
  patients: Patient[]
  inventory: InventoryItem[]
  labTests: LabTestProfile[]
  addVisit: (patientId: string, priority?: VisitPriority, insurance?: any, skipVitals?: boolean) => void
  updateVisit: (visit: Visit) => void
  onCompleteVisit?: (visit: Visit) => void
  restrictedStages?: VisitStage[] // New prop to filter the dashboard view
}

const PatientQueue: React.FC<PatientQueueProps> = ({
  visits,
  patients,
  inventory,
  labTests,
  addVisit,
  updateVisit,
  onCompleteVisit,
  restrictedStages,
}) => {
  // If restricted stages provided, default to the first one, otherwise Check-In
  const [activeStage, setActiveStage] = useState<VisitStage>(restrictedStages ? restrictedStages[0] : "Check-In")
  const [showCheckInModal, setShowCheckInModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const deferredSearchTerm = useDeferredValue(searchTerm)

  // Modal State
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)

  // Check-In State
  const [checkInPriority, setCheckInPriority] = useState<VisitPriority>("Normal")
  const [skipVitals, setSkipVitals] = useState(false)




  // Force re-render every minute to update times
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60000)
    return () => clearInterval(timer)
  }, [])

  // Update active stage if props change (e.g. switching views)
  useEffect(() => {
    if (restrictedStages && !restrictedStages.includes(activeStage)) {
      setActiveStage(restrictedStages[0])
    } else if (!restrictedStages && activeStage === undefined) {
      setActiveStage("Check-In")
    }
  }, [restrictedStages, activeStage])

  // Stage Definitions
  const allStages: { id: VisitStage; label: string; icon: any; color: string }[] = [
    { id: "Check-In", label: "Reception", icon: Users, color: "bg-blue-500" },
    { id: "Vitals", label: "Vitals", icon: Activity, color: "bg-orange-500" },
    { id: "Consultation", label: "Doctor", icon: Stethoscope, color: "bg-teal-600" },
    { id: "Lab", label: "Lab", icon: FlaskConical, color: "bg-indigo-500" },
    { id: "Billing", label: "Billing", icon: CreditCard, color: "bg-green-600" },
    { id: "Pharmacy", label: "Pharmacy", icon: Pill, color: "bg-purple-600" },
    { id: "Clearance", label: "Clearance", icon: LogOut, color: "bg-slate-500" },
  ]

  const visibleStages = restrictedStages ? allStages.filter((s) => restrictedStages.includes(s.id)) : allStages

  // Filter Visits based on Stage
  const filteredVisits = visits
    .filter((v) => v.stage === activeStage)
    .sort((a, b) => {
      // Sort by Priority (Emergency > Urgent > Normal) then Time
      const pMap = { Emergency: 3, Urgent: 2, Normal: 1 }
      if (pMap[a.priority] !== pMap[b.priority]) return pMap[b.priority] - pMap[a.priority]
      return new Date(a.stageStartTime).getTime() - new Date(b.stageStartTime).getTime()
    })

  const handleStageChange = (visit: Visit, nextStage: VisitStage) => {
    // Require billing.manage permission to move a visit to Billing
    if (nextStage === "Billing" && !canCurrentUser('billing.manage')) {
      useStore.getState().actions.showToast("You do not have permission to send to Billing.", "error")
      return
    }

    updateVisit({
      ...visit,
      stage: nextStage,
      stageStartTime: new Date().toISOString(), // Reset timer for new stage
    })
    setSelectedVisit(null)
  }

  const calculateTotal = (visit: Visit) => {
    const medCost = visit.prescription.reduce((acc, item) => acc + item.price * item.quantity, 0)
    const labCost = visit.labOrders.reduce((acc, item) => acc + item.price, 0)
    return visit.consultationFee + medCost + labCost
  }

  const getPriorityColor = (p: VisitPriority) => {
    if (p === "Emergency") return "bg-red-100 text-red-700 border-red-200 animate-pulse"
    if (p === "Urgent") return "bg-orange-100 text-orange-700 border-orange-200"
    return "bg-blue-50 text-blue-700 border-blue-200"
  }

  // --- Actions ---
  const handleCheckIn = (patientId: string) => {
    addVisit(patientId, checkInPriority, undefined, skipVitals)
    setShowCheckInModal(false)
    setSearchTerm("")
  }


  return (
    <div className="p-4 md:p-8 bg-gray-50 dark:bg-slate-900 min-h-screen transition-colors duration-200 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 gap-4">
        <div className="text-center sm:text-left">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            {restrictedStages ? "Department Dashboard" : "Patient Queue"}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {restrictedStages ? `Managing: ${restrictedStages.join(", ")}` : "Clinic patient flow overview"}
          </p>
        </div>

        <div className="flex items-center justify-center sm:justify-end gap-3">
          {/* Check In Button only for Reception or General Queue */}
          {(activeStage === "Check-In" || !restrictedStages || restrictedStages.includes("Check-In")) && (
            <button
              onClick={() => setShowCheckInModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95"
            >
              <UserPlus className="w-5 h-5" />
              <span>Check In</span>
            </button>
          )}
        </div>
      </div>

      {/* Stage Tabs (Only show if multiple stages visible) - MOBILE RESPONSIVE */}
      {visibleStages.length > 1 && (
        <StageTabs
          visibleStages={visibleStages}
          activeStage={activeStage}
          visits={visits}
          onStageChange={(id) => startTransition(() => setActiveStage(id))}
        />
      )}

      {/* Kanban Board Area - MOBILE RESPONSIVE */}
      <div className="bg-slate-100 dark:bg-slate-800/50 p-3 md:p-6 rounded-3xl min-h-[400px]">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-2">
          <h3 className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 text-xs sm:text-sm">
            <Clock className="w-4 h-4 flex-shrink-0" /> Queue: {activeStage}
          </h3>
          <span className="text-xs font-bold text-slate-400 self-start sm:self-auto">
            {filteredVisits.length} waiting
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
          {filteredVisits.map((visit) => (
            <VisitCard
              key={visit.id}
              visit={visit}
              activeStage={activeStage}
              onSelect={setSelectedVisit}
              calculateTotal={calculateTotal}
              getPriorityColor={getPriorityColor}
            />
          ))}

          {filteredVisits.length === 0 && (
            <div className="col-span-full py-20 text-center text-slate-400 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 opacity-20" />
              </div>
              <p className="font-bold">Queue Empty</p>
              <p className="text-sm opacity-70">No patients currently in {activeStage}</p>
            </div>
          )}
        </div>
      </div>

      <CheckInModal
        isOpen={showCheckInModal}
        onClose={() => setShowCheckInModal(false)}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        deferredSearchTerm={deferredSearchTerm}
        priority={checkInPriority}
        setPriority={setCheckInPriority}
        skipVitals={skipVitals}
        setSkipVitals={setSkipVitals}
        patients={patients}
        onCheckIn={handleCheckIn}
      />
      {selectedVisit && (
        <ActionModal
          visit={selectedVisit}
          activeStage={activeStage}
          patients={patients}
          inventory={inventory}
          labTests={labTests}
          onClose={() => setSelectedVisit(null)}
          onUpdateDraft={setSelectedVisit}
          onStageChange={handleStageChange}
          calculateTotal={calculateTotal}
          onPaymentModalOpen={() => setIsPaymentModalOpen(true)}
          onCompleteVisit={onCompleteVisit}
        />
      )}

      {/* Payment Modal Integration */}
      {selectedVisit && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          amount={calculateTotal(selectedVisit)}
          patientId={selectedVisit.patientId}
          patientName={selectedVisit.patientName}
          patientPhone={patients.find(p => p.id === selectedVisit.patientId)?.phone || ""}
          invoiceId={selectedVisit.id}
          onPaymentSuccess={(ref) => {
            const nextStage = selectedVisit.prescription.length > 0 ? "Pharmacy" : "Clearance"
            updateVisit({
              ...selectedVisit,
              totalBill: calculateTotal(selectedVisit),
              paymentStatus: "Paid",
              stage: nextStage,
              metadata: { ...selectedVisit.metadata, payment_ref: ref }
            })
            setIsPaymentModalOpen(false)
            setSelectedVisit(null)
          }}
        />
      )}
    </div>
  )
}

export default PatientQueue

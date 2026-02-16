import { useLocation } from "react-router-dom"
import PatientQueue from "../components/PatientQueue"
import useStore from "../store"
import type { VisitStage } from "../types"

// Map routes to their restricted stages
const routeToStages: Record<string, VisitStage[]> = {
    "/reception": ["Check-In", "Clearance"],
    "/triage": ["Vitals"],
    "/consultation": ["Consultation"],
    "/lab-work": ["Lab"],
    "/billing-desk": ["Billing"],
}

const PatientQueuePage = () => {
    const location = useLocation()
    const { visits, patients, inventory, labTests, actions } = useStore()

    // Get restricted stages based on current route
    const restrictedStages = routeToStages[location.pathname]

    return (
        <PatientQueue
            visits={visits}
            patients={patients}
            inventory={inventory}
            labTests={labTests}
            addVisit={actions.addVisit}
            updateVisit={actions.updateVisit}
            onCompleteVisit={actions.completeVisit}
            restrictedStages={restrictedStages}
        />
    )
}

export default PatientQueuePage

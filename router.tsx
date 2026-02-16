import { createBrowserRouter, Navigate } from "react-router-dom"
import { lazy, Suspense, ComponentType } from "react"
import AppLayout from "./components/AppLayout"
import Login from "./components/Login"

// Lazy load page wrappers
const DashboardPage = lazy(() => import("./pages/DashboardPage"))
const PatientListPage = lazy(() => import("./pages/PatientListPage"))
const AppointmentsPage = lazy(() => import("./pages/AppointmentsPage"))
const PharmacyPage = lazy(() => import("./pages/PharmacyPage"))
const ReportsPage = lazy(() => import("./pages/ReportsPage"))
const SettingsPage = lazy(() => import("./pages/SettingsPage"))
const ProfilePage = lazy(() => import("./pages/ProfilePage"))
const BulkSMSPage = lazy(() => import("./pages/BulkSMSPage"))
const PatientQueuePage = lazy(() => import("./pages/PatientQueuePage"))
const SuperAdminPage = lazy(() => import("./pages/SuperAdminPage"))
const WhatsAppAgentPage = lazy(() => import("./pages/WhatsAppAgentPage"))

// Loading fallback component
function PageLoader() {
    return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
        </div>
    )
}

// Wrapper for lazy components
function withSuspense(Component: React.LazyExoticComponent<ComponentType<any>>) {
    return (
        <Suspense fallback={<PageLoader />}>
            <Component />
        </Suspense>
    )
}

export const router = createBrowserRouter([
    {
        path: "/login",
        element: <Login />,
    },
    {
        path: "/",
        element: <AppLayout />,
        children: [
            {
                index: true,
                element: <Navigate to="/dashboard" replace />,
            },
            {
                path: "dashboard",
                element: withSuspense(DashboardPage),
            },
            {
                path: "reception",
                element: withSuspense(PatientQueuePage),
            },
            {
                path: "triage",
                element: withSuspense(PatientQueuePage),
            },
            {
                path: "consultation",
                element: withSuspense(PatientQueuePage),
            },
            {
                path: "lab-work",
                element: withSuspense(PatientQueuePage),
            },
            {
                path: "billing-desk",
                element: withSuspense(PatientQueuePage),
            },
            {
                path: "patients",
                element: withSuspense(PatientListPage),
            },
            {
                path: "appointments",
                element: withSuspense(AppointmentsPage),
            },
            {
                path: "pharmacy",
                element: withSuspense(PharmacyPage),
            },
            {
                path: "bulk-sms",
                element: withSuspense(BulkSMSPage),
            },
            {
                path: "whatsapp-agent",
                element: withSuspense(WhatsAppAgentPage),
            },
            {
                path: "reports",
                element: withSuspense(ReportsPage),
            },
            {
                path: "settings",
                element: withSuspense(SettingsPage),
            },
            {
                path: "profile",
                element: withSuspense(ProfilePage),
            },
            // Super Admin Routes
            {
                path: "sa-overview",
                element: withSuspense(SuperAdminPage),
            },
            {
                path: "sa-clinics",
                element: withSuspense(SuperAdminPage),
            },
            {
                path: "sa-approvals",
                element: withSuspense(SuperAdminPage),
            },
            {
                path: "sa-payments",
                element: withSuspense(SuperAdminPage),
            },
            {
                path: "sa-support",
                element: withSuspense(SuperAdminPage),
            },
            {
                path: "sa-settings",
                element: withSuspense(SuperAdminPage),
            },
        ],
    },
    {
        path: "*",
        element: <Navigate to="/dashboard" replace />,
    },
])

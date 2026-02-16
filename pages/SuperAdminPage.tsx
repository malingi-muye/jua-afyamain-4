import { useLocation, useNavigate } from "react-router-dom"
import SuperAdminDashboard from "../components/SuperAdminDashboard"
import useStore from "../store"
import { useEnterpriseAuth } from "../hooks/useEnterpriseAuth"

const SuperAdminPage = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const { currentUser, settings, actions } = useStore()
    const { signOut } = useEnterpriseAuth()

    const handleLogout = async () => {
        await signOut()
        actions.logout()
        navigate("/login", { replace: true })
    }

    // Extract tab from route (e.g., /sa-overview -> overview)
    const tab = location.pathname.replace("/sa-", "") as any

    if (!currentUser) return null

    return (
        <SuperAdminDashboard
            currentUser={currentUser}
            team={settings.team}
            activeTab={tab}
            onLogout={handleLogout}
            switchUser={actions.switchUser}
        />
    )
}

export default SuperAdminPage

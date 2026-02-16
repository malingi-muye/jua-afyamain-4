import { Navigate } from "react-router-dom"
import Settings from "../components/Settings"
import useStore from "../store"

const SettingsPage = () => {
    const { darkMode, settings, actions, currentUser } = useStore()

    if (currentUser?.role === 'SuperAdmin') {
        return <Navigate to="/sa-settings" replace />
    }

    return (
        <Settings
            isDarkMode={darkMode}
            toggleTheme={actions.toggleTheme}
            settings={settings}
            updateSettings={actions.updateSettings}
        />
    )
}

export default SettingsPage

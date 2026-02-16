import WhatsAppAgent from "../components/WhatsAppAgent"
import useStore from "../store"

const WhatsAppAgentPage = () => {
    const { settings, appointments, inventory, patients, actions } = useStore()

    return (
        <WhatsAppAgent
            team={settings.team}
            appointments={appointments}
            inventory={inventory}
            patients={patients}
            settings={settings}
            addPatient={actions.addPatient}
            updatePatient={actions.updatePatient}
            deletePatient={actions.deletePatient}
            addAppointment={actions.addAppointment}
            updateAppointment={actions.updateAppointment}
            updateInventoryItem={actions.updateInventoryItem}
            deleteInventoryItem={actions.deleteInventoryItem}
            updateSettings={actions.updateSettings}
        />
    )
}

export default WhatsAppAgentPage

import Appointments from "../components/Appointments"
import useStore from "../store"

const AppointmentsPage = () => {
    const { appointments, patients, actions } = useStore()

    return (
        <Appointments
            appointments={appointments}
            patients={patients}
            addAppointment={actions.addAppointment}
            updateAppointment={actions.updateAppointment}
            showToast={actions.showToast}
        />
    )
}

export default AppointmentsPage

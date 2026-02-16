import PatientList from "../components/PatientList"
import useStore from "../store"

const PatientListPage = () => {
    const { patients, settings, actions } = useStore()

    return (
        <PatientList
            patients={patients}
            addPatient={actions.addPatient}
            updatePatient={actions.updatePatient}
            deletePatient={actions.deletePatient}
            settings={settings}
        />
    )
}

export default PatientListPage

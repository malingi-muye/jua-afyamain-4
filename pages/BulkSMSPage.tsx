import BulkSMS from "../components/BulkSMS"
import useStore from "../store"

const BulkSMSPage = () => {
    const { patients, settings, actions } = useStore()

    return (
        <BulkSMS
            patients={patients}
            showToast={actions.showToast}
            settings={settings}
        />
    )
}

export default BulkSMSPage

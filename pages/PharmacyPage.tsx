import Pharmacy from "../components/Pharmacy"
import useStore from "../store"

const PharmacyPage = () => {
    const { inventory, suppliers, inventoryLogs, visits, actions } = useStore()

    return (
        <Pharmacy
            inventory={inventory}
            suppliers={suppliers}
            logs={inventoryLogs}
            visits={visits}
            onDispense={actions.dispensePrescription}
            addInventoryItem={actions.addInventoryItem}
            updateInventoryItem={actions.updateInventoryItem}
            deleteInventoryItem={actions.deleteInventoryItem}
            addSupplier={actions.addSupplier}
            updateSupplier={actions.updateSupplier}
            deleteSupplier={actions.deleteSupplier}
        />
    )
}

export default PharmacyPage

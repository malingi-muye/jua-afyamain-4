import type { Patient } from "../../types"
import { Phone, FileText, MoreHorizontal } from "lucide-react"

interface RecentPatientsTableProps {
    patients: Patient[]
    onCall?: (phone: string) => void
    onViewDetails?: (patient: Patient) => void
    limit?: number
}

export function RecentPatientsTable({
    patients,
    onCall,
    onViewDetails,
    limit = 5,
}: RecentPatientsTableProps) {
    const recentPatients = patients.slice(0, limit)

    return (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl shadow-slate-200/60 dark:shadow-slate-900/30 border border-slate-100 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Recent Patients</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Latest registered patients</p>
                </div>
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                    <MoreHorizontal className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                </button>
            </div>

            {recentPatients.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <p>No patients registered yet</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-700">
                                <th className="text-left py-3 px-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Patient
                                </th>
                                <th className="text-left py-3 px-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">
                                    Phone
                                </th>
                                <th className="text-left py-3 px-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">
                                    Last Visit
                                </th>
                                <th className="text-right py-3 px-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentPatients.map((patient) => (
                                <tr
                                    key={patient.id}
                                    className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                >
                                    <td className="py-3 px-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-brand-blue/10 flex items-center justify-center text-brand-blue font-bold text-sm">
                                                {patient.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-800 dark:text-white text-sm">
                                                    {patient.name}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {patient.age ? `${patient.age} yrs` : "—"} • {patient.gender || "—"}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-2 hidden md:table-cell">
                                        <span className="text-sm text-slate-600 dark:text-slate-300">
                                            {patient.phone || "—"}
                                        </span>
                                    </td>
                                    <td className="py-3 px-2 hidden sm:table-cell">
                                        <span className="text-sm text-slate-600 dark:text-slate-300">
                                            {patient.lastVisit || "Never"}
                                        </span>
                                    </td>
                                    <td className="py-3 px-2 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {patient.phone && onCall && (
                                                <button
                                                    onClick={() => onCall(patient.phone)}
                                                    className="p-2 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                                                    title="Call"
                                                >
                                                    <Phone className="w-4 h-4 text-green-600 dark:text-green-400" />
                                                </button>
                                            )}
                                            {onViewDetails && (
                                                <button
                                                    onClick={() => onViewDetails(patient)}
                                                    className="p-2 hover:bg-brand-blue/10 rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <FileText className="w-4 h-4 text-brand-blue" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { MoreHorizontal, Download } from "lucide-react"

interface PatientFlowChartProps {
    data: Array<{
        hour: string
        patients: number
    }>
    onExport?: () => void
}

export function PatientFlowChart({ data, onExport }: PatientFlowChartProps) {
    return (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl shadow-slate-200/60 dark:shadow-slate-900/30 border border-slate-100 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Patient Flow</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Hourly visit distribution</p>
                </div>
                <div className="flex items-center gap-2">
                    {onExport && (
                        <button
                            onClick={onExport}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                            title="Export Data"
                        >
                            <Download className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                        </button>
                    )}
                    <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                        <MoreHorizontal className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    </button>
                </div>
            </div>

            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                        <XAxis
                            dataKey="hour"
                            className="text-slate-500"
                            tick={{ fill: "#94a3b8", fontSize: 12 }}
                            axisLine={{ stroke: "#e2e8f0" }}
                        />
                        <YAxis
                            className="text-slate-500"
                            tick={{ fill: "#94a3b8", fontSize: 12 }}
                            axisLine={{ stroke: "#e2e8f0" }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "#1e293b",
                                border: "none",
                                borderRadius: "12px",
                                color: "#f8fafc",
                            }}
                        />
                        <Bar dataKey="patients" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}

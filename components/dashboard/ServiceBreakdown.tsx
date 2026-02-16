import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { MoreHorizontal } from "lucide-react"

interface ServiceBreakdownProps {
    data: Array<{
        name: string
        value: number
        color: string
    }>
}

export function ServiceBreakdown({ data }: ServiceBreakdownProps) {
    const total = data.reduce((sum, item) => sum + item.value, 0)

    return (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl shadow-slate-200/60 dark:shadow-slate-900/30 border border-slate-100 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Services</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Breakdown by type</p>
                </div>
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                    <MoreHorizontal className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                </button>
            </div>

            <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={4}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "#1e293b",
                                border: "none",
                                borderRadius: "12px",
                                color: "#f8fafc",
                            }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
                {data.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: item.color }}
                        />
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                            {item.name}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-white ml-auto">
                            {total > 0 ? Math.round((item.value / total) * 100) : 0}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}

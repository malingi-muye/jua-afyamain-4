import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react"

interface StatCardProps {
    title: string
    value: string | number
    icon: LucideIcon
    iconBgColor: string
    iconColor: string
    trend?: {
        value: number
        label: string
    }
    subtitle?: string
}

export function StatCard({
    title,
    value,
    icon: Icon,
    iconBgColor,
    iconColor,
    trend,
    subtitle,
}: StatCardProps) {
    const getTrendIcon = () => {
        if (!trend) return null
        if (trend.value > 0) return <TrendingUp className="w-4 h-4 text-green-500" />
        if (trend.value < 0) return <TrendingDown className="w-4 h-4 text-red-500" />
        return <Minus className="w-4 h-4 text-slate-400" />
    }

    const getTrendColor = () => {
        if (!trend) return ""
        if (trend.value > 0) return "text-green-600 dark:text-green-400"
        if (trend.value < 0) return "text-red-600 dark:text-red-400"
        return "text-slate-500"
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-slate-200/60 dark:shadow-slate-900/30 p-6 flex items-start justify-between transition-all duration-300 hover:shadow-2xl hover:-translate-y-0.5 border border-slate-100 dark:border-slate-700/50">
            <div className="space-y-2">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
                <p className="text-3xl font-bold text-slate-800 dark:text-white">{value}</p>
                {trend && (
                    <div className={`flex items-center gap-1 text-xs font-medium ${getTrendColor()}`}>
                        {getTrendIcon()}
                        <span>{Math.abs(trend.value)}%</span>
                        <span className="text-slate-400 dark:text-slate-500">{trend.label}</span>
                    </div>
                )}
                {subtitle && (
                    <p className="text-xs text-slate-400 dark:text-slate-500">{subtitle}</p>
                )}
            </div>
            <div className={`p-3 rounded-2xl ${iconBgColor}`}>
                <Icon className={`w-6 h-6 ${iconColor}`} />
            </div>
        </div>
    )
}

import { useState } from "react"
import { Sparkles, Loader2 } from "lucide-react"
import { generateDailyBriefing } from "../../services/geminiService"

interface DashboardStats {
    todayPatients: number
    todayAppointments: number
    completedVisits: number
    lowStockCount: number
    todayRevenue: number
}

interface AIBriefingCardProps {
    stats: DashboardStats
}

export function AIBriefingCard({ stats }: AIBriefingCardProps) {
    const [briefing, setBriefing] = useState("")
    const [isLoadingBriefing, setIsLoadingBriefing] = useState(false)

    const handleGetBriefing = async () => {
        setIsLoadingBriefing(true)
        try {
            const result = await generateDailyBriefing(
                stats.todayAppointments,
                stats.lowStockCount,
                `${stats.todayRevenue.toLocaleString()} KSh`
            )
            setBriefing(result)
        } catch (error) {
            console.error("Briefing error:", error)
        } finally {
            setIsLoadingBriefing(false)
        }
    }

    return (
        <div className="relative overflow-hidden bg-gradient-to-br from-teal-500 via-teal-600 to-teal-700 dark:from-teal-600 dark:via-teal-700 dark:to-teal-800 rounded-3xl p-5 sm:p-6 text-white shadow-xl shadow-teal-500/20 group">
            {/* Animated backgrounds */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-teal-400/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>

            <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md border border-white/20 shadow-inner">
                            <Sparkles className="w-5 h-5 text-white animate-pulse" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base sm:text-lg tracking-tight">AI Assistant</h3>
                            <p className="text-[10px] sm:text-xs text-teal-50 uppercase font-bold tracking-widest opacity-80">Candy's Daily Brief</p>
                        </div>
                    </div>
                    {briefing && (
                        <button
                            onClick={() => setBriefing("")}
                            className="text-teal-100 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-lg"
                        >
                            <Loader2 className="w-4 h-4 rotate-45" />
                        </button>
                    )}
                </div>

                {briefing ? (
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 text-sm leading-relaxed border border-white/10 shadow-lg animate-in fade-in zoom-in-95 duration-300">
                        <div className="text-teal-50 font-medium">
                            {briefing}
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                            <span className="text-[10px] text-teal-100 font-bold uppercase tracking-wider">Ready to assist</span>
                            <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 bg-white/40 rounded-full"></div>
                                <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce delay-75"></div>
                                <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce delay-150"></div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <p className="text-sm text-teal-50 leading-relaxed font-medium">
                            Hello! I'm Candy. Ready for a quick performance summary and some AI-powered recommendations for today?
                        </p>

                        <button
                            onClick={handleGetBriefing}
                            disabled={isLoadingBriefing}
                            className="w-full py-3.5 px-4 bg-white text-teal-700 font-bold rounded-2xl hover:bg-teal-50 hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed text-sm group/btn"
                        >
                            {isLoadingBriefing ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Analyzing Metrics...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5 text-teal-500 group-hover/btn:rotate-12 transition-transform" />
                                    <span>Generate My Briefing</span>
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

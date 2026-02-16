"use client"

import React, { memo } from "react"
import type { Visit, VisitStage } from "../../types"

interface StageTabsProps {
    visibleStages: { id: VisitStage; label: string; icon: any; color: string }[]
    activeStage: VisitStage
    visits: Visit[]
    onStageChange: (stageId: VisitStage) => void
}

const StageTabs: React.FC<StageTabsProps> = ({
    visibleStages,
    activeStage,
    visits,
    onStageChange
}) => {
    return (
        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-6 scrollbar-hide mb-4 md:mb-8 md:grid md:grid-cols-7">
            {visibleStages.map((stage) => {
                const isActive = activeStage === stage.id
                const count = visits.filter((v) => v.stage === stage.id).length
                return (
                    <button
                        key={stage.id}
                        onClick={() => onStageChange(stage.id)}
                        className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl transition-all border-2 relative flex-shrink-0 min-w-[100px] sm:min-w-[120px] md:min-w-0 ${isActive
                            ? `border-${stage.color.split("-")[1]}-500 bg-white dark:bg-slate-800 shadow-xl transform -translate-y-1`
                            : "border-transparent bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 text-slate-400"
                            }`}
                    >
                        {visits.some((v) => v.stage === stage.id && v.priority === "Emergency") && (
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                        )}
                        <div className={`p-2 rounded-xl text-white mb-2 ${stage.color} shadow-sm`}>
                            <stage.icon className="w-4 h-4" />
                        </div>
                        <div className={`text-xs font-bold text-center ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                            {stage.label}
                        </div>
                        <div className={`text-[10px] font-bold mt-1 px-2 py-0.5 rounded-full ${isActive ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' : 'text-slate-400'}`}>
                            {count} patients
                        </div>
                    </button>
                )
            })}
        </div>
    )
}

export default memo(StageTabs)

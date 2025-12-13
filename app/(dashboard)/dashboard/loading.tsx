export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto">
        {/* Header Skeleton */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
          <div className="space-y-3">
            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-40 animate-pulse" />
            <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-64 animate-pulse" />
          </div>
        </div>

        {/* Metrics Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700"
            >
              <div className="space-y-3">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32 animate-pulse" />
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-24 animate-pulse" />
              </div>
            </div>
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700"
            >
              <div className="space-y-4">
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-40 animate-pulse" />
                <div className="h-72 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

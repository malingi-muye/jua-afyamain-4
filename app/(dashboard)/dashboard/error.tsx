'use client'

import DashboardErrorBoundary from '@/components/dashboard/error-boundary'

interface DashboardErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  return <DashboardErrorBoundary error={error} reset={reset} />
}

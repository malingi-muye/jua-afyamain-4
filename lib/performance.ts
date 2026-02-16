/**
 * Performance Monitoring & Observability
 * Implements: Performance budgets, tracing, and real user monitoring
 */

interface PerformanceMetric {
    name: string
    value: number
    timestamp: number
    metadata?: Record<string, any>
}

class PerformanceMonitor {
    private metrics: PerformanceMetric[] = []
    private budgets: Map<string, number> = new Map()
    private enabled: boolean = import.meta.env.PROD || import.meta.env.VITE_ENABLE_PERF_MONITORING === 'true'

    constructor() {
        // Set performance budgets (in milliseconds)
        this.budgets.set('page_load', 3000)
        this.budgets.set('api_call', 1000)
        this.budgets.set('component_render', 100)
        this.budgets.set('interaction', 100)
    }

    /**
     * Mark the start of a performance measurement
     */
    mark(name: string) {
        if (!this.enabled) return
        performance.mark(`${name}-start`)
    }

    /**
     * Mark the end and measure duration
     */
    measure(name: string, metadata?: Record<string, any>) {
        if (!this.enabled) return

        try {
            performance.mark(`${name}-end`)
            const measure = performance.measure(name, `${name}-start`, `${name}-end`)

            const metric: PerformanceMetric = {
                name,
                value: measure.duration,
                timestamp: Date.now(),
                metadata
            }

            this.metrics.push(metric)
            this.checkBudget(name, measure.duration)

            // Log to console in dev mode
            if (import.meta.env.DEV) {
                console.log(`⏱️ [Performance] ${name}: ${measure.duration.toFixed(2)}ms`, metadata || '')
            }

            // Clean up marks
            performance.clearMarks(`${name}-start`)
            performance.clearMarks(`${name}-end`)
            performance.clearMeasures(name)

            return measure.duration
        } catch (e) {
            console.warn(`Performance measurement failed for ${name}:`, e)
        }
    }

    /**
     * Check if measurement exceeds budget
     */
    private checkBudget(name: string, duration: number) {
        const category = name.split('_')[0] // Extract category from name like "page_dashboard"
        const budget = this.budgets.get(category)

        if (budget && duration > budget) {
            console.warn(
                `⚠️ Performance Budget Exceeded: ${name} took ${duration.toFixed(2)}ms (budget: ${budget}ms)`
            )
        }
    }

    /**
     * Get Core Web Vitals
     */
    getCoreWebVitals() {
        if (!this.enabled || typeof window === 'undefined') return null

        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming

        return {
            // First Contentful Paint
            FCP: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
            // Largest Contentful Paint (requires observer)
            LCP: 0, // Would need PerformanceObserver
            // Time to Interactive
            TTI: navigation ? navigation.domInteractive - navigation.fetchStart : 0,
            // Total Blocking Time
            TBT: 0, // Would need PerformanceObserver
            // Cumulative Layout Shift
            CLS: 0, // Would need PerformanceObserver
        }
    }

    /**
     * Get all metrics
     */
    getMetrics() {
        return this.metrics
    }

    /**
     * Get metrics summary
     */
    getSummary() {
        const summary: Record<string, { count: number; avg: number; max: number; min: number }> = {}

        this.metrics.forEach(metric => {
            if (!summary[metric.name]) {
                summary[metric.name] = { count: 0, avg: 0, max: 0, min: Infinity }
            }

            const s = summary[metric.name]
            s.count++
            s.max = Math.max(s.max, metric.value)
            s.min = Math.min(s.min, metric.value)
            s.avg = (s.avg * (s.count - 1) + metric.value) / s.count
        })

        return summary
    }

    /**
     * Clear all metrics
     */
    clear() {
        this.metrics = []
    }

    /**
     * Export metrics for analysis
     */
    export() {
        return {
            metrics: this.metrics,
            summary: this.getSummary(),
            webVitals: this.getCoreWebVitals(),
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
        }
    }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor()

/**
 * React Hook for measuring component render performance
 */
export function usePerformanceTrace(componentName: string) {
    if (import.meta.env.DEV) {
        performanceMonitor.mark(`component_${componentName}`)

        return () => {
            performanceMonitor.measure(`component_${componentName}`)
        }
    }
    return () => { }
}

/**
 * Decorator for measuring async function performance
 */
export function traced<T extends (...args: any[]) => Promise<any>>(
    name: string,
    fn: T
): T {
    return (async (...args: any[]) => {
        performanceMonitor.mark(name)
        try {
            const result = await fn(...args)
            performanceMonitor.measure(name)
            return result
        } catch (error) {
            performanceMonitor.measure(name, { error: true })
            throw error
        }
    }) as T
}

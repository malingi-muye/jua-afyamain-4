import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { router } from './router';
import './index.css';
import logger from './lib/logger';
import { performanceMonitor } from './lib/performance';

// Initialize Vercel Speed Insights
injectSpeedInsights();

// Suppress Recharts dimension warnings; forward other warnings to central logger
// Using `logger.warn` keeps warnings subject to `VERBOSE` flag.
if (typeof window !== 'undefined') {
  const originalWarn = console.warn.bind(console);

  console.warn = (...args) => {
    try {
      const firstArg = args[0];
      if (typeof firstArg === 'string') {
        const lowerArg = firstArg.toLowerCase();
        // Suppress Recharts dimension warnings
        if (lowerArg.includes('width') && lowerArg.includes('height')) return;
        // Suppress non-actionable host/insights warnings from browser extensions/internal modules
        if (lowerArg.includes('host validation') || lowerArg.includes('host is not supported')) return;
        if (lowerArg.includes('insights whitelist')) return;
      }
    } catch (e) { }
    logger.warn(...args);
  };

  const originalError = console.error.bind(console);
  console.error = (...args) => {
    try {
      const firstArg = args[0];
      if (typeof firstArg === 'string') {
        const lowerArg = firstArg.toLowerCase();
        // Suppress non-actionable host errors
        if (lowerArg.includes('host validation') || lowerArg.includes('host is not supported')) return;
        if (lowerArg.includes('insights whitelist')) return;
      }
    } catch (e) { }
    originalError(...args);
  };
}

// Create a client for React Query with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - data stays fresh
      gcTime: 1000 * 60 * 10, // 10 minutes - cache garbage collection (formerly cacheTime)
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.status >= 400 && error?.status < 500) return false
        // Retry up to 2 times for network/server errors
        return failureCount < 2
      },
      refetchOnWindowFocus: false, // Prevent refetch on tab switch (can be annoying)
      refetchOnReconnect: true, // Refetch when internet reconnects
      networkMode: 'online', // Only fetch when online
    },
    mutations: {
      retry: 1, // Retry mutations once on failure
      networkMode: 'online',
    },
  },
});

// Expose performance monitor to window for debugging
if (typeof window !== 'undefined') {
  (window as any).performanceMonitor = performanceMonitor
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
);

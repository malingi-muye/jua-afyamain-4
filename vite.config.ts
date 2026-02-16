import path from "path"
import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")

  // Fallback to process.env for Netlify-injected variables
  const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  const geminiKey = env.VITE_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ""

  return {
    server: {
      port: 3000,
      host: "0.0.0.0",
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    define: {
      // Support VITE_ prefix (standard Vite convention)
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabaseKey),
      // Also inject NEXT_PUBLIC_ variants for production builds
      "import.meta.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify(supabaseKey),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id) return
            // Vendor chunks: split heavy deps for independent browser caching
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'vendor-charts'
            if (id.includes('node_modules/@radix-ui')) return 'vendor-radix'
            if (id.includes('node_modules/@supabase')) return 'vendor-supabase'
            if (id.includes('node_modules/@tanstack/react-query')) return 'vendor-query'
            // App page chunks
            if (id.includes('components/PatientList') || id.includes('pages/PatientListPage')) return 'patient-list'
            if (id.includes('components/WhatsAppAgent') || id.includes('pages/WhatsAppAgentPage')) return 'whatsapp-agent'
            if (id.includes('components/Reports') || id.includes('pages/ReportsPage')) return 'reports'
            if (id.includes('components/Profile') || id.includes('pages/ProfilePage')) return 'profile'
            if (id.includes('components/Dashboard') || id.includes('pages/DashboardPage')) return 'dashboard'
          }
        }
      },
      chunkSizeWarningLimit: 800,
      // Enable source maps for production debugging
      sourcemap: true,
      // Minimize CSS
      cssMinify: true,
    },
    optimizeDeps: {
      include: [
        'lucide-react', 'react', 'react-dom',
        '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-tabs', '@radix-ui/react-scroll-area',
        'recharts', 'zustand', '@tanstack/react-query',
      ],
    },
  }
})

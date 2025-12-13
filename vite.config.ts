import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  define: {
    'import.meta.env.VITE_NEXT_SUPABASE_URL': JSON.stringify(process.env.NEXT_SUPABASE_URL),
    'import.meta.env.VITE_NEXT_SUPABASE_ANON_KEY': JSON.stringify(process.env.NEXT_SUPABASE_ANON_KEY),
    'import.meta.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(process.env.NEXT_SUPABASE_URL),
    'import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(process.env.NEXT_SUPABASE_ANON_KEY),
  }
});

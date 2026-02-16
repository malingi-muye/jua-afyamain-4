import { TeamMember } from '../types/index';

export const SYSTEM_ADMIN: TeamMember = {
  id: 'sys-owner',
  name: 'System Owner',
  email: 'admin@juaafya-saas.com',
  phone: '+254700000000',
  role: 'SuperAdmin',
  status: 'Active',
  lastActive: 'Now',
  avatar: 'https://ui-avatars.com/api/?name=System+Owner&background=312e81&color=fff'
};

// Runtime/dev config flags to control logging and auth timeouts.
// Use Vite env `VITE_VERBOSE_LOGS=true` to enable verbose logs in development.
export const VERBOSE_LOGS = typeof import.meta !== 'undefined' && Boolean((import.meta as any).env?.VITE_VERBOSE_LOGS === 'true' || (import.meta as any).env?.DEV);

// Timeouts (ms) used by authentication hooks. Tweak if Supabase is slow.
// Reduced for better UX - most operations complete within 5-10s
export const AUTH_WARNING_MS = 8000; // when to show a warning (8s)
export const AUTH_TIMEOUT_MS = 15000; // hard timeout for init (15s)
export const FETCH_TIMEOUT_MS = 10000; // individual fetch timeout (10s)

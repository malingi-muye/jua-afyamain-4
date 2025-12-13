'use server'

import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import RoleBasedDashboard from '@/components/dashboard/role-based-dashboard'
import { db } from '@/services/db'

async function getDashboardData() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  try {
    // Fetch all dashboard data in parallel
    const [patients, appointments, inventory, visits, suppliers] = await Promise.all([
      db.getPatients().catch(() => []),
      db.getAppointments().catch(() => []),
      db.getInventory().catch(() => []),
      db.getVisits().catch(() => []),
      db.getSuppliers().catch(() => []),
    ])

    // Get user profile data
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    return {
      user: {
        id: user.id,
        email: user.email,
        name: profile?.full_name || user.user_metadata?.full_name || 'User',
        role: profile?.role || 'admin',
        avatar_url: profile?.avatar_url,
      },
      data: {
        patients,
        appointments,
        inventory,
        visits,
        suppliers,
      },
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || 'User',
        role: 'admin',
        avatar_url: null,
      },
      data: {
        patients: [],
        appointments: [],
        inventory: [],
        visits: [],
        suppliers: [],
      },
    }
  }
}

export default async function DashboardPage() {
  const dashboardData = await getDashboardData()

  return (
    <RoleBasedDashboard
      user={dashboardData.user}
      initialData={dashboardData.data}
    />
  )
}

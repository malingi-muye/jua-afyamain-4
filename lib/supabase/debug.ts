import { getSupabaseClient } from "./singleton"

// Add to window for debugging
(window as any).debugSupabase = () => {
  try {
    const client = getSupabaseClient()
    console.log("✓ Supabase client initialized successfully")
    console.log("Client URL:", (client as any)._url)
    console.log("Full client:", client)
  } catch (error) {
    console.error("✗ Supabase client initialization failed:", error)
  }
}

console.log("Debug helper added to window. Run: window.debugSupabase()")

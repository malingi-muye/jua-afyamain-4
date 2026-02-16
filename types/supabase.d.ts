export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email?: string | null
          last_login_at?: string | null
          updated_at?: string | null
          user_metadata?: Json | null
        }
        Insert: {
          id?: string
          email?: string | null
          last_login_at?: string | null
          updated_at?: string | null
          user_metadata?: Json | null
        }
        Update: {
          id?: string
          email?: string | null
          last_login_at?: string | null
          updated_at?: string | null
          user_metadata?: Json | null
        }
      }
      profiles: {
        Row: {
          id: string
          clinic_id?: string | null
          full_name?: string | null
          role?: string | null
          avatar_url?: string | null
        }
        Insert: { id: string; clinic_id?: string | null; full_name?: string | null; role?: string | null; avatar_url?: string | null }
        Update: { id?: string; clinic_id?: string | null; full_name?: string | null; role?: string | null; avatar_url?: string | null }
      }
      clinics: {
        Row: { id: string; name: string; email?: string | null; phone?: string | null; location?: string | null; currency?: string | null; created_at?: string | null }
        Insert: { id?: string; name: string; email?: string | null; phone?: string | null; location?: string | null; currency?: string | null }
        Update: { id?: string; name?: string; email?: string | null; phone?: string | null; location?: string | null; currency?: string | null }
      }
      patients: {
        Row: { id: string; clinic_id: string; name: string; phone?: string | null; age?: number | null; gender?: string | null; notes?: string | null; updated_at?: string | null }
        Insert: { id?: string; clinic_id: string; name: string; phone?: string | null; age?: number | null; gender?: string | null; notes?: string | null }
        Update: { id?: string; clinic_id?: string; name?: string; phone?: string | null; age?: number | null; gender?: string | null; notes?: string | null }
      }
      inventory: {
        Row: { id: string; clinic_id: string; name: string; stock?: number | null }
        Insert: { id?: string; clinic_id: string; name: string; stock?: number | null }
        Update: { id?: string; clinic_id?: string; name?: string; stock?: number | null }
      }
      appointments: {
        Row: { id: string; clinic_id: string; patient_id?: string | null; patient_name?: string | null; date?: string | null; time?: string | null; status?: string | null }
        Insert: { id?: string; clinic_id: string; patient_id?: string | null; patient_name?: string | null; date?: string | null; time?: string | null; status?: string | null }
        Update: { id?: string; clinic_id?: string; patient_id?: string | null; patient_name?: string | null; date?: string | null; time?: string | null; status?: string | null }
      }
      visits: {
        Row: { id: string; clinic_id: string; patient_id?: string | null; stage?: string | null; total_bill?: number | null }
        Insert: { id?: string; clinic_id: string; patient_id?: string | null; stage?: string | null; total_bill?: number | null }
        Update: { id?: string; clinic_id?: string; patient_id?: string | null; stage?: string | null; total_bill?: number | null }
      }
      suppliers: {
        Row: { id: string; clinic_id: string; name: string }
        Insert: { id?: string; clinic_id: string; name: string }
        Update: { id?: string; clinic_id?: string; name?: string }
      }
      audit_logs: {
        Row: { id: string; user_id?: string | null; action: string; entity_type: string; entity_id?: string | null; changes?: Json | null; status?: string | null; timestamp?: string | null }
        Insert: { user_id?: string | null; action: string; entity_type: string; entity_id?: string | null; changes?: Json | null; status?: string | null; timestamp?: string | null }
        Update: { user_id?: string | null; action?: string; entity_type?: string; entity_id?: string | null; changes?: Json | null; status?: string | null; timestamp?: string | null }
      }
      transactions: { Row: any; Insert: any; Update: any }
      support_tickets: { Row: any; Insert: any; Update: any }
      invoices: { Row: any; Insert: any; Update: any }
      activities: { Row: any; Insert: any; Update: any }
      inventory_logs: { Row: any; Insert: any; Update: any }
    }
    Views: {}
    Functions: {}
  }
}

export {}

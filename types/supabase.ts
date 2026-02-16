// Supabase Database type definitions for type-safe queries
// Generated from database schema

export interface Database {
    public: {
        Tables: {
            clinics: {
                Row: {
                    id: string
                    name: string
                    email: string | null
                    phone: string | null
                    location: string | null
                    currency: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    email?: string | null
                    phone?: string | null
                    location?: string | null
                    currency?: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    email?: string | null
                    phone?: string | null
                    location?: string | null
                    currency?: string
                    created_at?: string
                }
            }
            profiles: {
                Row: {
                    id: string
                    clinic_id: string | null
                    full_name: string | null
                    role: string | null
                    avatar_url: string | null
                }
                Insert: {
                    id: string
                    clinic_id?: string | null
                    full_name?: string | null
                    role?: string | null
                    avatar_url?: string | null
                }
                Update: {
                    id?: string
                    clinic_id?: string | null
                    full_name?: string | null
                    role?: string | null
                    avatar_url?: string | null
                }
            }
            patients: {
                Row: {
                    id: string
                    clinic_id: string
                    name: string
                    phone: string | null
                    age: number | null
                    gender: string | null
                    notes: string | null
                    last_visit: string | null
                    history: any[]
                    vitals: Record<string, any>
                    created_at: string
                }
                Insert: {
                    id?: string
                    clinic_id: string
                    name: string
                    phone?: string | null
                    age?: number | null
                    gender?: string | null
                    notes?: string | null
                    last_visit?: string | null
                    history?: any[]
                    vitals?: Record<string, any>
                    created_at?: string
                }
                Update: {
                    id?: string
                    clinic_id?: string
                    name?: string
                    phone?: string | null
                    age?: number | null
                    gender?: string | null
                    notes?: string | null
                    last_visit?: string | null
                    history?: any[]
                    vitals?: Record<string, any>
                    created_at?: string
                }
            }
            inventory: {
                Row: {
                    id: string
                    clinic_id: string
                    name: string
                    category: string | null
                    stock: number
                    min_stock_level: number
                    unit: string | null
                    price: number
                    batch_number: string | null
                    expiry_date: string | null
                    supplier_id: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    clinic_id: string
                    name: string
                    category?: string | null
                    stock?: number
                    min_stock_level?: number
                    unit?: string | null
                    price?: number
                    batch_number?: string | null
                    expiry_date?: string | null
                    supplier_id?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    clinic_id?: string
                    name?: string
                    category?: string | null
                    stock?: number
                    min_stock_level?: number
                    unit?: string | null
                    price?: number
                    batch_number?: string | null
                    expiry_date?: string | null
                    supplier_id?: string | null
                    created_at?: string
                }
            }
            appointments: {
                Row: {
                    id: string
                    clinic_id: string
                    patient_id: string | null
                    patient_name: string | null
                    date: string | null
                    time: string | null
                    reason: string | null
                    status: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    clinic_id: string
                    patient_id?: string | null
                    patient_name?: string | null
                    date?: string | null
                    time?: string | null
                    reason?: string | null
                    status?: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    clinic_id?: string
                    patient_id?: string | null
                    patient_name?: string | null
                    date?: string | null
                    time?: string | null
                    reason?: string | null
                    status?: string
                    created_at?: string
                }
            }
            visits: {
                Row: {
                    id: string
                    clinic_id: string
                    patient_id: string | null
                    patient_name: string | null
                    stage: string | null
                    stage_start_time: string | null
                    start_time: string | null
                    queue_number: number | null
                    priority: string | null
                    vitals: Record<string, any>
                    lab_orders: any[]
                    prescription: any[]
                    medications_dispensed: boolean
                    consultation_fee: number
                    total_bill: number
                    payment_status: string
                    chief_complaint: string | null
                    diagnosis: string | null
                    doctor_notes: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    clinic_id: string
                    patient_id?: string | null
                    patient_name?: string | null
                    stage?: string | null
                    stage_start_time?: string | null
                    start_time?: string | null
                    queue_number?: number | null
                    priority?: string | null
                    vitals?: Record<string, any>
                    lab_orders?: any[]
                    prescription?: any[]
                    medications_dispensed?: boolean
                    consultation_fee?: number
                    total_bill?: number
                    payment_status?: string
                    chief_complaint?: string | null
                    diagnosis?: string | null
                    doctor_notes?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    clinic_id?: string
                    patient_id?: string | null
                    patient_name?: string | null
                    stage?: string | null
                    stage_start_time?: string | null
                    start_time?: string | null
                    queue_number?: number | null
                    priority?: string | null
                    vitals?: Record<string, any>
                    lab_orders?: any[]
                    prescription?: any[]
                    medications_dispensed?: boolean
                    consultation_fee?: number
                    total_bill?: number
                    payment_status?: string
                    chief_complaint?: string | null
                    diagnosis?: string | null
                    doctor_notes?: string | null
                    created_at?: string
                }
            }
            suppliers: {
                Row: {
                    id: string
                    clinic_id: string
                    name: string
                    contact_person: string | null
                    phone: string | null
                    email: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    clinic_id: string
                    name: string
                    contact_person?: string | null
                    phone?: string | null
                    email?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    clinic_id?: string
                    name?: string
                    contact_person?: string | null
                    phone?: string | null
                    email?: string | null
                    created_at?: string
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            get_my_clinic_id: {
                Args: Record<PropertyKey, never>
                Returns: string
            }
        }
        Enums: {
            [_ in never]: never
        }
    }
}

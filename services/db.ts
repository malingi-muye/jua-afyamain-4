import { supabase } from '../lib/supabaseClient';
import { Patient, InventoryItem, Appointment, Visit, Supplier, InventoryLog } from '../types';
// Note: Permission checks are enforced by Supabase Row Level Security (RLS) policies
import { enterpriseDb } from './enterprise-db';
import logger from '../lib/logger';

export const db = {
    // --- Connection Check ---
    checkConnection: async (): Promise<boolean> => {
        try {
            // Check connection by querying a lightweight table or system info
            const { error } = await supabase.from('clinics').select('count', { count: 'exact', head: true });
            return !error;
        } catch (e) {
            console.error("Supabase connection check failed:", e);
            return false;
        }
    },

    // --- Patients ---
    getPatients: async (): Promise<Patient[]> => {
        const { data, error } = await supabase
            .from('patients')
            .select('id, name, phone, age, gender, updated_at, history, vitals')
            .order('updated_at', { ascending: false })
            .limit(100);

        if (error) throw error;

        return (data || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            phone: p.phone,
            age: p.age,
            gender: p.gender,
            lastVisit: p.updated_at?.split('T')[0] || new Date().toISOString().split('T')[0],
            history: p.history || [],
            vitals: p.vitals || {}
        }));
    },

    createPatient: async (patient: Patient): Promise<Patient> => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...payload } = patient; // Remove temporary ID

        // Calculate date of birth from age if needed
        const dateOfBirth = payload.age ? new Date(Date.now() - payload.age * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null;

        const { data, error } = await supabase.from('patients').insert({
            name: payload.name,
            phone: payload.phone,
            age: payload.age,
            gender: payload.gender,
            history: payload.history,
            vitals: payload.vitals,
            clinic_id: await (async () => {
                const { data: userClinic } = await supabase.from('users').select('clinic_id').eq('id', (await supabase.auth.getUser()).data.user?.id).single();
                return userClinic?.clinic_id;
            })(),
            mrn: `MRN-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
        }).select().single();

        if (error) throw error;

        return {
            id: data.id,
            name: data.name,
            phone: data.phone,
            age: data.age,
            gender: data.gender,
            notes: data.notes || "",
            lastVisit: data.updated_at?.split('T')[0] || "",
            history: data.history || [],
            vitals: data.vitals || {}
        };
    },
    updatePatient: async (patient: Patient) => {
        const dateOfBirth = patient.age ? new Date(Date.now() - patient.age * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null;

        const { error } = await supabase.from('patients').update({
            name: patient.name,
            phone: patient.phone,
            age: patient.age,
            gender: patient.gender,
            history: patient.history,
            vitals: patient.vitals,
            updated_at: new Date().toISOString()
        }).eq('id', patient.id);

        if (error) throw error;
    },

    deletePatient: async (id: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Note: Permission checks enforced by Supabase RLS policies
        // await guardServerAction(user.id, 'patients.delete');

        // Audit existing patient
        try {
            const { data: oldPatient } = await supabase.from('patients').select('*').eq('id', id).maybeSingle();
            await enterpriseDb.logAudit('delete_patient', 'patient', id, oldPatient || undefined, undefined);
        } catch (e) {
            logger.warn('Failed to write audit for deletePatient:', e);
        }

        const { error } = await supabase.from('patients').delete().eq('id', id);
        if (error) throw error;
    },

    getInventory: async (): Promise<InventoryItem[]> => {
        const { data, error } = await supabase.from('inventory').select('*').order('name').limit(100);
        if (error) throw error;

        return (data || []).map((i: any) => ({
            id: i.id,
            name: i.name,
            category: i.category,
            stock: i.quantity_in_stock || i.stock,
            minStockLevel: i.reorder_level || i.min_stock_level,
            unit: i.unit,
            price: i.price,
            batchNumber: i.batch_number,
            expiryDate: i.expiry_date,
            supplierId: i.supplier_id
        }));
    },

    createInventoryItem: async (item: InventoryItem): Promise<InventoryItem> => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...payload } = item;

        const { data, error } = await supabase.from('inventory').insert({
            name: payload.name,
            category: payload.category,
            min_stock_level: payload.minStockLevel,
            unit: payload.unit,
            price: payload.price,
            batch_number: payload.batchNumber,
            expiry_date: payload.expiryDate,
            supplier_id: payload.supplierId
        }).select().single();

        if (error) throw error;

        return {
            id: data.id,
            name: data.name,
            category: data.category,
            stock: data.stock,
            minStockLevel: data.min_stock_level,
            unit: data.unit,
            price: data.price,
            batchNumber: data.batch_number,
            expiryDate: data.expiry_date,
            supplierId: data.supplier_id
        };
    },

    updateInventoryItem: async (item: InventoryItem) => {
        const { error } = await supabase.from('inventory').update({
            name: item.name,
            category: item.category,
            stock: item.stock,
            min_stock_level: item.minStockLevel,
            unit: item.unit,
            price: item.price,
            batch_number: item.batchNumber,
            expiry_date: item.expiryDate,
            supplier_id: item.supplierId
        }).eq('id', item.id);
        if (error) throw error;
    },

    deleteInventoryItem: async (id: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Note: Permission checks enforced by Supabase RLS policies
        // await guardServerAction(user.id, 'inventory.delete');

        try {
            const { data: oldItem } = await supabase.from('inventory').select('*').eq('id', id).maybeSingle();
            await enterpriseDb.logAudit('delete_inventory_item', 'inventory_item', id, oldItem || undefined, undefined);
        } catch (e) {
            logger.warn('Failed to write audit for deleteInventoryItem:', e);
        }

        const { error } = await supabase.from('inventory').delete().eq('id', id);
        if (error) throw error;
    },

    // --- Inventory Logs ---
    getInventoryLogs: async (): Promise<InventoryLog[]> => {
        const { data, error } = await supabase
            .from('inventory_logs')
            .select('id, item_id, item_name, action, quantity_change, notes, created_at, user_name')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        return (data || []).map((l: any) => ({
            id: l.id,
            itemId: l.item_id,
            itemName: l.item_name,
            action: l.action,
            quantityChange: l.quantity_change,
            notes: l.notes,
            timestamp: l.created_at, // Map created_at to timestamp
            user: l.user_name || l.user
        }));
    },

    createInventoryLog: async (log: Omit<InventoryLog, 'id' | 'timestamp'>): Promise<InventoryLog> => {
        const { data, error } = await supabase.from('inventory_logs').insert({
            item_id: log.itemId,
            item_name: log.itemName,
            action: log.action,
            quantity_change: log.quantityChange,
            notes: log.notes,
            user_name: log.user
        }).select().single();

        if (error) throw error;

        return {
            id: data.id,
            itemId: data.item_id,
            itemName: data.item_name,
            action: data.action,
            quantityChange: data.quantity_change,
            notes: data.notes,
            timestamp: data.created_at, // Map created_at to timestamp
            user: data.user_name || data.user
        };
    },

    // --- Appointments ---
    getAppointments: async (): Promise<Appointment[]> => {
        const { data, error } = await supabase
            .from('appointments')
            .select('id, patient_id, patient_name, date, time, reason, status')
            .order('date', { ascending: true })
            .limit(200);

        if (error) throw error;

        return (data || []).map((a: any) => ({
            id: a.id,
            patientId: a.patient_id,
            patientName: a.patient_name,
            date: a.date,
            time: a.time,
            reason: a.reason,
            status: a.status
        }));
    },

    createAppointment: async (appt: Appointment): Promise<Appointment> => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...payload } = appt;

        const { data, error } = await supabase.from('appointments').insert({
            patient_id: payload.patientId,
            patient_name: payload.patientName,
            date: payload.date,
            time: payload.time,
            reason: payload.reason,
            status: payload.status
        }).select().single();

        if (error) throw error;

        return {
            id: data.id,
            patientId: data.patient_id,
            patientName: data.patient_name,
            date: data.date,
            time: data.time,
            reason: data.reason,
            status: data.status
        };
    },

    updateAppointment: async (appt: Appointment) => {
        const { error } = await supabase.from('appointments').update({
            date: appt.date,
            time: appt.time,
            reason: appt.reason,
            status: appt.status
        }).eq('id', appt.id);
        if (error) throw error;
    },

    deleteAppointment: async (id: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Note: Permission checks enforced by Supabase RLS policies
        // await guardServerAction(user.id, 'appointments.delete');

        try {
            const { data: oldAppt } = await supabase.from('appointments').select('*').eq('id', id).maybeSingle();
            await enterpriseDb.logAudit('delete_appointment', 'appointment', id, oldAppt || undefined, undefined);
        } catch (e) {
            logger.warn('Failed to write audit for deleteAppointment:', e);
        }

        const { error } = await supabase.from('appointments').delete().eq('id', id);
        if (error) throw error;
    },

    // --- Visits ---
    getVisits: async (): Promise<Visit[]> => {
        const { data, error } = await supabase
            .from('visits')
            .select('id, patient_id, patient_name, stage, stage_start_time, start_time, queue_number, priority, vitals, lab_orders, prescription, medications_dispensed, consultation_fee, total_bill, payment_status, chief_complaint, diagnosis, doctor_notes')
            .neq('stage', 'Completed')
            .order('start_time', { ascending: false })
            .limit(50);
        if (error) throw error;

        return (data || []).map((v: any) => ({
            id: v.id,
            patientId: v.patient_id,
            patientName: v.patient_name,
            stage: v.stage,
            stageStartTime: v.stage_start_time,
            startTime: v.start_time,
            queueNumber: v.queue_number,
            priority: v.priority,
            vitals: v.vitals || {},
            labOrders: v.lab_orders || [],
            prescription: v.prescription || [],
            medicationsDispensed: v.medications_dispensed,
            consultationFee: v.consultation_fee,
            totalBill: v.total_bill,
            paymentStatus: v.payment_status,
            chiefComplaint: v.chief_complaint,
            diagnosis: v.diagnosis,
            doctorNotes: v.doctor_notes
        }));
    },

    createVisit: async (visit: Visit): Promise<Visit> => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...payload } = visit;

        const { data, error } = await supabase.from('visits').insert({
            patient_id: payload.patientId,
            patient_name: payload.patientName,
            stage: payload.stage,
            stage_start_time: payload.stageStartTime,
            start_time: payload.startTime,
            queue_number: payload.queueNumber,
            priority: payload.priority,
            vitals: payload.vitals,
            lab_orders: payload.labOrders,
            prescription: payload.prescription,
            medications_dispensed: payload.medicationsDispensed,
            consultation_fee: payload.consultationFee,
            total_bill: payload.totalBill,
            payment_status: payload.paymentStatus,
            chief_complaint: payload.chiefComplaint,
            diagnosis: payload.diagnosis,
            doctor_notes: payload.doctorNotes
        }).select().single();

        if (error) throw error;

        return {
            id: data.id,
            patientId: data.patient_id,
            patientName: data.patient_name,
            stage: data.stage,
            stageStartTime: data.stage_start_time,
            startTime: data.start_time,
            queueNumber: data.queue_number,
            priority: data.priority,
            vitals: data.vitals || {},
            labOrders: data.lab_orders || [],
            prescription: data.prescription || [],
            medicationsDispensed: data.medications_dispensed,
            consultationFee: data.consultation_fee,
            totalBill: data.total_bill,
            paymentStatus: data.payment_status,
            chiefComplaint: data.chief_complaint,
            diagnosis: data.diagnosis,
            doctorNotes: data.doctor_notes
        };
    },

    updateVisit: async (visit: Visit) => {
        const { error } = await supabase.from('visits').update({
            stage: visit.stage,
            stage_start_time: visit.stageStartTime,
            vitals: visit.vitals,
            lab_orders: visit.labOrders,
            prescription: visit.prescription,
            medications_dispensed: visit.medicationsDispensed,
            total_bill: visit.totalBill,
            payment_status: visit.paymentStatus,
            chief_complaint: visit.chiefComplaint,
            diagnosis: visit.diagnosis,
            doctor_notes: visit.doctorNotes
        }).eq('id', visit.id);

        if (error) {
            logger.warn("DB Update failed (possibly running on mock IDs in Demo Mode)", error);
            throw error;
        }
    },

    // --- Suppliers ---
    getSuppliers: async (): Promise<Supplier[]> => {
        const { data, error } = await supabase.from('suppliers').select('id, name, contact_person, phone, email');
        if (error) throw error;

        return (data || []).map((s: any) => ({
            id: s.id,
            name: s.name,
            contactPerson: s.contact_person,
            phone: s.phone,
            email: s.email
        }));
    },

    createSupplier: async (supplier: Supplier): Promise<Supplier> => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...payload } = supplier;

        const { data, error } = await supabase.from('suppliers').insert({
            name: payload.name,
            contact_person: payload.contactPerson,
            phone: payload.phone,
            email: payload.email
        }).select().single();

        if (error) throw error;

        return {
            id: data.id,
            name: data.name,
            contactPerson: data.contact_person,
            phone: data.phone,
            email: data.email
        };
    },

    updateSupplier: async (supplier: Supplier) => {
        const { error } = await supabase.from('suppliers').update({
            name: supplier.name,
            contact_person: supplier.contactPerson,
            phone: supplier.phone,
            email: supplier.email
        }).eq('id', supplier.id);

        if (error) throw error;
    },

    deleteSupplier: async (id: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Note: Permission checks enforced by Supabase RLS policies
        // await guardServerAction(user.id, 'inventory.delete');

        try {
            const { data: oldSupplier } = await supabase.from('suppliers').select('*').eq('id', id).maybeSingle();
            await enterpriseDb.logAudit('delete_supplier', 'supplier', id, oldSupplier || undefined, undefined);
        } catch (e) {
            logger.warn('Failed to write audit for deleteSupplier:', e);
        }

        const { error } = await supabase.from('suppliers').delete().eq('id', id);
        if (error) throw error;
    },

    // --- Settings ---
    getSettings: async (): Promise<import('../types').ClinicSettings | null> => {
        // Get current user's clinic_id first
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        // Get user's clinic_id with error handling
        let userDataResult;
        try {
            userDataResult = await supabase
                .from('users')
                .select('clinic_id')
                .eq('id', user.id)
                .maybeSingle();
        } catch (e) {
            console.warn("Error fetching user profile for settings:", e);
            return null;
        }

        const userData = userDataResult?.data;

        if (!userData?.clinic_id) {
            // No clinic associated - return null
            return null;
        }

        const { data, error } = await supabase
            .from('clinics')
            .select('*')
            .eq('id', userData.clinic_id)
            .maybeSingle();

        if (error) {
            console.error("Error fetching clinic settings:", error);
            return null;
        }

        if (!data) {
            // No clinic found - return null
            return null;
        }

        const c = data;
        const settingsJson = c.settings || {};
        const pc = settingsJson.paymentConfig || { provider: "None", apiKey: "", secretKey: "", testMode: true, isConfigured: false };

        // Mask secret key before sending to client
        const maskedSecret = pc.secretKey ? `${pc.secretKey.substring(0, 7)}...${pc.secretKey.substring(pc.secretKey.length - 4)}` : "";

        return {
            name: c.name,
            phone: c.phone || "",
            email: c.email || "",
            location: c.location || "",
            currency: c.currency || "KES",
            timezone: c.timezone || "Africa/Nairobi",
            language: "English",
            logo: c.logo_url || "",
            smsEnabled: settingsJson.smsEnabled ?? true,
            smsConfig: settingsJson.smsConfig || { apiKey: "", senderId: "" },
            paymentConfig: { ...pc, secretKey: maskedSecret },
            notifications: settingsJson.notifications || { appointmentReminders: true, lowStockAlerts: true, dailyReports: false, marketingEmails: false, alertEmail: c.email },
            security: settingsJson.security || { twoFactorEnabled: false, lastPasswordChange: new Date().toISOString().split('T')[0] },
            billing: {
                plan: c.plan === 'free' ? 'Free' : c.plan === 'pro' ? 'Pro' : 'Enterprise',
                status: c.status === 'active' ? 'Active' : 'Past Due',
                nextBillingDate: c.trial_ends_at || new Date().toISOString().split('T')[0],
                paymentMethod: settingsJson.billing?.paymentMethod || { type: "Card", last4: "0000", brand: "Generic", expiry: "00/00" }
            },
            team: settingsJson.team || []
        };
    },

    updateSettings: async (settings: import('../types').ClinicSettings, clinicId?: string) => {
        let actualClinicId = clinicId;

        if (!actualClinicId) {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { data: userData } = await supabase
                .from('users')
                .select('clinic_id')
                .eq('id', user.id)
                .single();
            actualClinicId = userData?.clinic_id;
        }

        if (!actualClinicId) throw new Error("Clinic context not found");

        // Get current settings to handle masked secret key
        const { data: currentClinic } = await supabase
            .from('clinics')
            .select('settings')
            .eq('id', actualClinicId)
            .single();

        const currentSettings = currentClinic?.settings || {};
        const currentPC = currentSettings.paymentConfig || {};

        // If the incoming secretKey is masked (contains '...'), preserve the original
        let finalSecretKey = settings.paymentConfig.secretKey;
        if (finalSecretKey && finalSecretKey.includes('...')) {
            finalSecretKey = currentPC.secretKey;
        }

        const settingsJson = {
            smsEnabled: settings.smsEnabled,
            smsConfig: settings.smsConfig,
            paymentConfig: {
                ...settings.paymentConfig,
                secretKey: finalSecretKey
            },
            notifications: settings.notifications,
            security: settings.security,
            billing: {
                paymentMethod: settings.billing.paymentMethod
            },
            team: settings.team
        };
        const { error } = await supabase
            .from('clinics')
            .update({
                name: settings.name,
                phone: settings.phone,
                email: settings.email,
                location: settings.location,
                currency: settings.currency,
                timezone: settings.timezone,
                logo_url: settings.logo,
                settings: settingsJson,
                updated_at: new Date().toISOString()
            })
            .eq('id', actualClinicId);

        if (error) throw error;
        return true;
    },

    // --- Super Admin ---
    getAllClinics: async (): Promise<import('../types').Clinic[]> => {
        const { data, error } = await supabase
            .from('clinics')
            .select(`
                *,
                users (
                    full_name,
                    role
                ),
                transactions (
                    amount,
                    status,
                    created_at
                )
            `);

        if (error) throw error;

        return (data || []).map((c: any) => {
            // Find the clinic admin or owner
            // We standardize on 'Admin' and 'SuperAdmin' but check lowercase for legacy compatibility
            const owner = c.users?.find((u: any) =>
                u.role === 'Admin' ||
                u.role === 'SuperAdmin' ||
                u.role === 'admin' ||
                u.role === 'super_admin'
            ) || c.users?.[0];

            // Calculate Revenue YTD (Successful transactions in current year)
            const currentYear = new Date().getFullYear();
            const revenueYTD = (c.transactions || [])
                .filter((t: any) => t.status === 'Success' && new Date(t.created_at).getFullYear() === currentYear)
                .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

            // Map status: DB stores lowercase, UI uses capitalized
            const dbStatus = (c.status || '').toLowerCase();
            const mappedStatus = dbStatus === 'active' ? 'Active' : dbStatus === 'pending' ? 'Pending' : 'Suspended';

            return {
                id: c.id,
                name: c.name,
                ownerName: owner?.full_name || "Pending",
                email: c.email || owner?.email || "No Email",
                plan: (c.plan || 'free').toLowerCase() === 'free' ? 'Free' : (c.plan || '').toLowerCase() === 'pro' ? 'Pro' : 'Enterprise',
                status: mappedStatus,
                // Include raw status for debugging
                rawStatus: c.status,
                joinedDate: c.created_at ? c.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
                lastPaymentDate: c.last_payment_date || '-',
                nextPaymentDate: c.trial_ends_at || c.next_payment_date || '-',
                revenueYTD: revenueYTD
            };
        });
    },

    createClinic: async (clinic: Partial<import('../types').Clinic>) => {
        const { data, error } = await supabase.from('clinics').insert({
            name: clinic.name,
            email: clinic.email,
            plan: clinic.plan?.toLowerCase(),
            status: clinic.status?.toLowerCase() || 'active',
            // owner_id left null or handled by trigger/logic
        }).select().single();

        if (error) throw error;
        return data;
    },

    updateClinic: async (id: string, updates: Partial<import('../types').Clinic>) => {
        const dbUpdates: any = {};
        if (updates.name) dbUpdates.name = updates.name;
        if (updates.email) dbUpdates.email = updates.email;
        if (updates.plan) dbUpdates.plan = updates.plan.toLowerCase();
        if (updates.status) dbUpdates.status = updates.status.toLowerCase();

        const { error } = await supabase.from('clinics').update(dbUpdates).eq('id', id);
        if (error) throw error;
    },

    deleteClinic: async (id: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Note: Permission checks enforced by Supabase RLS policies
        // await guardServerAction(user.id, 'super_admin.delete');

        try {
            const { data: oldClinic } = await supabase.from('clinics').select('*').eq('id', id).maybeSingle();
            await enterpriseDb.logAudit('hard_delete_clinic', 'clinic', id, oldClinic || undefined, undefined);
        } catch (e) {
            logger.warn('Failed to write audit for deleteClinic:', e);
        }

        const { error } = await supabase.from('clinics').delete().eq('id', id);
        if (error) throw error;
    },

    assignClinicAdmin: async (clinicId: string, email: string) => {
        // 1. Check if user exists
        const { data: user } = await supabase
            .from('users')
            .select('id, clinic_id')
            .eq('email', email)
            .maybeSingle();

        if (user) {
            // User exists, update them
            // If they are already in a different clinic, we might be moving them. 
            // For now, we assume we overwrite the clinic_id.
            const { error: updateError } = await supabase
                .from('users')
                .update({ clinic_id: clinicId, role: 'admin', status: 'Active' })
                .eq('id', user.id);
            if (updateError) throw updateError;
        } else {
            // User does not exist in 'users' table. 
            // We create a provisional user record. 
            // They will need to sign up with this email (or be invited via Auth) to claim it.
            const { error: insertError } = await supabase.from('users').insert({
                email: email,
                clinic_id: clinicId,
                role: 'admin',
                status: 'Invited',
                full_name: email.split('@')[0] // Temporary name
            });
            if (insertError) throw insertError;
        }
    },

    // --- SaaS Transactions ---
    getTransactions: async (): Promise<import('../types').SaaSTransaction[]> => {
        const { data, error } = await supabase.from('transactions').select('*, clinics(name)');
        if (error) throw error;

        return data.map((t: any) => ({
            id: t.id,
            clinicId: t.clinic_id,
            clinicName: t.clinics?.name || 'Unknown',
            amount: t.amount,
            date: t.created_at.split('T')[0],
            status: t.status,
            method: t.method,
            plan: t.plan
        }));
    },

    createTransaction: async (txn: Partial<import('../types').SaaSTransaction> & { clinicId: string }) => {
        const { data, error } = await supabase.from('transactions').insert({
            clinic_id: txn.clinicId,
            amount: txn.amount,
            status: txn.status,
            method: txn.method,
            plan: txn.plan,
            // reference: txn.reference // Assuming generated or passed
        }).select().single();
        if (error) throw error;
        return data;
    },

    updateTransaction: async (id: string, updates: Partial<import('../types').SaaSTransaction>) => {
        const { error } = await supabase.from('transactions').update(updates).eq('id', id);
        if (error) throw error;
    },

    // --- Support Tickets ---
    getSupportTickets: async (clinicId?: string): Promise<import('../types').SupportTicket[]> => {
        let query = supabase.from('support_tickets').select('*, clinics(name)');

        if (clinicId) {
            query = query.eq('clinic_id', clinicId);
        }

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map((t: any) => ({
            id: t.id,
            clinicName: t.clinics?.name || 'Unknown',
            subject: t.subject,
            priority: t.priority,
            status: t.status,
            messages: (t.messages || []).map((msg: any) => ({
                ...msg,
                role: (msg.role || '').toLowerCase() === 'admin' ? 'admin' : (msg.role || '').toLowerCase() === 'user' ? 'user' : msg.role
            })),
            dateCreated: t.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
            lastUpdate: t.updated_at?.split('T')[0] || new Date().toISOString().split('T')[0]
        }));
    },

    createSupportTicket: async (ticket: Partial<import('../types').SupportTicket> & { clinicId: string, userId?: string, messages: any[] }) => {
        const { data, error } = await supabase.from('support_tickets').insert({
            clinic_id: ticket.clinicId,
            user_id: ticket.userId,
            subject: ticket.subject,
            priority: ticket.priority,
            status: 'Open',
            messages: ticket.messages
        }).select().single();
        if (error) throw error;
        return data;
    },

    updateSupportTicket: async (id: string, updates: Partial<import('../types').SupportTicket> & { messages?: any[] }) => {
        const payload: any = {};
        if (updates.status) payload.status = updates.status;
        if (updates.priority) payload.priority = updates.priority;
        if (updates.messages) payload.messages = updates.messages;
        payload.updated_at = new Date().toISOString();

        const { error } = await supabase.from('support_tickets').update(payload).eq('id', id);
        if (error) throw error;
    },

    // --- Audit Logs ---
    getAuditLogs: async (filters: { type?: string, search?: string, limit?: number, offset?: number } = {}): Promise<import('../types').AuditLogEntry[]> => {
        let query = supabase
            .from('audit_logs')
            .select('*', { count: 'exact' });

        if (filters.type && filters.type !== 'All') {
            query = query.ilike('action', `%${filters.type}%`);
        }

        if (filters.search) {
            query = query.or(`user_name.ilike.%${filters.search}%,resource_type.ilike.%${filters.search}%,action.ilike.%${filters.search}%`);
        }

        const limit = filters.limit || 50;
        const offset = filters.offset || 0;

        const { data, error } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        return (data || []).map((log: any) => ({
            id: log.id,
            clinicId: log.clinic_id,
            userId: log.user_id,
            userName: log.user_name || log.user_email || 'System',
            userRole: log.user_role,
            action: log.action,
            resourceType: log.resource_type || 'Unknown',
            resourceId: log.resource_id,
            details: log.details,
            status: log.status === 'success' ? 'Success' : log.status === 'failed' ? 'Error' : 'Warning',
            createdAt: log.created_at
        }));
    },

    // --- Notifications ---
    getNotifications: async (userId: string): Promise<any[]> => {
        try {
            const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10);
            if (error) {
                // Fallback if table doesn't exist
                return [
                    { id: '1', title: 'Welcome', message: 'Welcome to JuaAfya Super Admin.', type: 'info', created_at: new Date().toISOString() }
                ];
            }
            return data || [];
        } catch (e) {
            logger.warn("Notifications fetch failed", e);
            return [
                { id: '1', title: 'Welcome', message: 'Welcome to JuaAfya Super Admin.', type: 'info', created_at: new Date().toISOString() }
            ];
        }
    },

    // --- User Profile ---
    updateUser: async (id: string, updates: Partial<{ name: string; email: string; phone: string; avatar: string; designation?: string; address?: string; bio?: string; preferences?: any }>) => {
        const payload: any = {};

        if (updates.name) payload.full_name = updates.name;
        if (updates.avatar) {
            const avatarVal = updates.avatar as string
            if (avatarVal.startsWith('avatars/')) {
                payload.avatar_path = avatarVal
            } else {
                payload.avatar_url = avatarVal
            }
        }
        if (updates.email) payload.email = updates.email;
        if (updates.phone) payload.phone = updates.phone;

        // Map designation to specialization (common field in our schema for user roles/titles)
        if (updates.designation) payload.specialization = updates.designation;

        // Since 'address' and 'bio' are not top-level columns, store them in preferences
        if (updates.address || updates.bio || updates.preferences) {
            payload.preferences = {
                ...(updates.preferences || {}),
                address: updates.address || (updates.preferences as any)?.address,
                bio: updates.bio || (updates.preferences as any)?.bio
            }
        }

        const { error } = await supabase.from('users').update(payload).eq('id', id);

        if (error) throw error;
    },

    // --- Platform Settings ---
    getPlatformSettings: async (): Promise<any> => {
        try {
            // Try to fetch from a 'platform_settings' table, id=1
            const { data, error } = await supabase.from('platform_settings').select('*').eq('id', 1).single();
            if (error || !data) {
                return {
                    maintenanceMode: false,
                    allowNewRegistrations: true,
                    globalAnnouncement: '',
                    pricing: { free: 0, pro: 5000, enterprise: 15000 },
                    gateways: {
                        mpesa: { paybill: '522522', account: 'JUAAFYA', name: 'JuaAfya Ltd', enabled: true },
                        bank: { name: 'KCB Bank', branch: 'Head Office', account: '1100223344', swift: 'KCBLKENX', enabled: true },
                        paystack: { publicKey: '', secretKey: '', enabled: false }
                    }
                };
            }

            const settings = data.settings;
            // Mask platform secret key
            if (settings.gateways?.paystack?.secretKey) {
                const sk = settings.gateways.paystack.secretKey;
                settings.gateways.paystack.secretKey = `${sk.substring(0, 7)}...${sk.substring(sk.length - 4)}`;
            }

            return settings;
        } catch (e) {
            logger.warn("Platform settings fetch failed, using defaults", e);
            return {
                maintenanceMode: false,
                allowNewRegistrations: true,
                globalAnnouncement: '',
                pricing: { free: 0, pro: 5000, enterprise: 15000 },
                gateways: {
                    mpesa: { paybill: '522522', account: 'JUAAFYA', name: 'JuaAfya Ltd', enabled: true },
                    bank: { name: 'KCB Bank', branch: 'Head Office', account: '1100223344', swift: 'KCBLKENX', enabled: true },
                    paystack: { publicKey: '', secretKey: '', enabled: false }
                }
            };
        }
    },

    savePlatformSettings: async (settings: any) => {
        // Get current settings to check for masked secret key
        const { data: currentRecord } = await supabase.from('platform_settings').select('settings').eq('id', 1).maybeSingle();
        const currentSettings = currentRecord?.settings || {};

        let finalSecretKey = settings.gateways?.paystack?.secretKey;
        const currentSecretKey = currentSettings.gateways?.paystack?.secretKey;

        // Preserve original if user sent back the masked version
        if (finalSecretKey && finalSecretKey.includes('...') && currentSecretKey) {
            settings.gateways.paystack.secretKey = currentSecretKey;
        }

        const { error } = await supabase.from('platform_settings').upsert({
            id: 1,
            settings,
            updated_at: new Date().toISOString()
        });
        if (error) throw error;
    },
    // --- Lab Tests (Catalog) ---
    getLabTests: async (): Promise<import('../types').LabTestProfile[]> => {
        const { data, error } = await supabase.from('lab_test_profiles').select('*');
        if (error) {
            console.warn('Error fetching lab tests from DB:', error);
            return [];
        }
        return (data || []).map((t: any) => ({
            id: t.id,
            name: t.name,
            price: t.price,
            category: t.category,
            unit: t.unit,
            referenceRange: t.reference_range
        }));
    }
};

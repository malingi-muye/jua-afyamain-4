
const API_BASE_URL = 'https://sms.mobiwave.co.ke/api/v3';

// NOTE: Mobiwave API calls should be made through Supabase Edge Functions
// to keep the API token secure on the server side.
// This service is kept for reference but should be migrated to edge functions.

export interface MobiwaveResponse<T = any> {
    status: 'success' | 'error';
    data?: T;
    message?: string;
}

export interface MobiwaveContact {
    uid: string;
    phone: string;
    first_name?: string;
    last_name?: string;
}

export interface MobiwaveGroup {
    uid: string;
    name: string;
}

// Helper to call Mobiwave via Supabase Edge Function
async function callMobiwaveEdgeFunction(action: string, payload: any): Promise<MobiwaveResponse> {
    try {
        const { supabase } = await import('../lib/supabaseClient');
        const { data, error } = await supabase.functions.invoke('mobiwave-proxy', {
            body: { action, ...payload }
        });

        if (error) {
            return { status: 'error', message: error.message };
        }

        return data || { status: 'error', message: 'No response from server' };
    } catch (error) {
        return { status: 'error', message: String(error) };
    }
}

export const mobiwaveService = {
    // --- SMS API ---
    sendSMS: async (recipient: string, message: string, senderId: string = 'JuaAfya'): Promise<MobiwaveResponse> => {
        return callMobiwaveEdgeFunction('sendSMS', {
            recipient,
            sender_id: senderId,
            type: 'plain',
            message,
        });
    },

    sendCampaign: async (contactListId: string, message: string, senderId: string = 'JuaAfya'): Promise<MobiwaveResponse> => {
        return callMobiwaveEdgeFunction('sendCampaign', {
            contact_list_id: contactListId,
            sender_id: senderId,
            type: 'plain',
            message,
        });
    },

    // --- Contacts API ---
    getContactsInGroup: async (groupId: string): Promise<MobiwaveResponse> => {
        return callMobiwaveEdgeFunction('getContactsInGroup', { groupId });
    },

    storeContact: async (groupId: string, phone: string, firstName?: string, lastName?: string): Promise<MobiwaveResponse> => {
        return callMobiwaveEdgeFunction('storeContact', {
            groupId,
            phone,
            first_name: firstName,
            last_name: lastName,
        });
    },

    updateContact: async (groupId: string, contactUid: string, phone: string, firstName?: string, lastName?: string): Promise<MobiwaveResponse> => {
        return callMobiwaveEdgeFunction('updateContact', {
            groupId,
            contactUid,
            phone,
            first_name: firstName,
            last_name: lastName,
        });
    },

    deleteContact: async (groupId: string, contactUid: string): Promise<MobiwaveResponse> => {
        return callMobiwaveEdgeFunction('deleteContact', { groupId, contactUid });
    },

    // --- Groups API ---
    getGroups: async (): Promise<MobiwaveResponse> => {
        return callMobiwaveEdgeFunction('getGroups', {});
    },

    storeGroup: async (name: string): Promise<MobiwaveResponse> => {
        return callMobiwaveEdgeFunction('storeGroup', { name });
    },

    deleteGroup: async (groupId: string): Promise<MobiwaveResponse> => {
        return callMobiwaveEdgeFunction('deleteGroup', { groupId });
    },
};

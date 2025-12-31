import { getCurrentUser } from './auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = 'https://crustiest-ilda-anemographically.ngrok-free.dev';

/**
 * Sync all data to cloud
 */
export const syncToCloud = async (pantry, favorites, shoppingList, filters) => {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return { success: false, error: 'Not signed in' };
        }

        // Get auth token from AsyncStorage
        const token = await AsyncStorage.getItem('authToken');

        if (!token) {
            return { success: false, error: 'No auth token' };
        }

        const response = await fetch(`${BACKEND_URL}/api/user/data`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                pantry,
                favorites,
                shoppingList,
                filters
            })
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Sync error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get data from cloud
 */
export const getCloudData = async () => {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return { success: false, error: 'Not signed in' };
        }

        const token = await AsyncStorage.getItem('authToken');
        if (!token) return { success: false, error: 'No auth token' };

        const response = await fetch(`${BACKEND_URL}/api/user/data`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();
        // UNWRAP: Backend returns { success: true, data: { pantry: ... } }
        // We want { success: true, pantry: ... } for easier consumption
        if (result.success && result.data) {
            return { success: true, ...result.data };
        }
        return result;
    } catch (error) {
        console.error('Get cloud data error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Sync specific field to cloud
 */
export const syncField = async (field, data) => {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return { success: false, error: 'Not signed in' };
        }

        const token = await AsyncStorage.getItem('authToken');
        if (!token) return { success: false, error: 'No auth token' };

        const response = await fetch(`${BACKEND_URL}/api/user/data/${field}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ [field]: data })
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Sync field error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Auto-sync with debounce (call this after data changes)
 */
let syncTimeout = null;
export const autoSync = async (pantry, favorites, shoppingList, filters) => {
    // Clear previous timeout
    if (syncTimeout) {
        clearTimeout(syncTimeout);
    }

    // Debounce sync by 2 seconds
    syncTimeout = setTimeout(async () => {
        const result = await syncToCloud(pantry, favorites, shoppingList, filters);
        if (result.success) {
            console.log('✅ Auto-synced to cloud');
        } else {
            console.log('❌ Auto-sync failed:', result.error);
        }
    }, 2000);
};

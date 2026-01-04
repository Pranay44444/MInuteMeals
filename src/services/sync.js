import { getUser } from './auth'
import AsyncStorage from '@react-native-async-storage/async-storage'

import Constants from 'expo-constants'
const API = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000'

export const pushToCloud = async (pantry, favorites, shoppingList, filters) => {
    try {
        const user = await getUser()
        if (!user) return { success: false, error: 'Not signed in' }

        const token = await AsyncStorage.getItem('authToken')
        if (!token) return { success: false, error: 'No token' }

        const res = await fetch(`${API}/api/user/data`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ pantry, favorites, shoppingList, filters })
        })

        return await res.json()
    } catch (err) {
        console.error('Sync error:', err)
        return { success: false, error: err.message }
    }
}

export const pullFromCloud = async () => {
    try {
        const user = await getUser()
        if (!user) return { success: false, error: 'Not signed in' }

        const token = await AsyncStorage.getItem('authToken')
        if (!token) return { success: false, error: 'No token' }

        const res = await fetch(`${API}/api/user/data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })

        const result = await res.json()
        if (result.success && result.data) {
            return { success: true, ...result.data }
        }
        return result
    } catch (err) {
        console.error('Pull error:', err)
        return { success: false, error: err.message }
    }
}

export const pushField = async (field, data) => {
    try {
        const user = await getUser()
        if (!user) return { success: false, error: 'Not signed in' }

        const token = await AsyncStorage.getItem('authToken')
        if (!token) return { success: false, error: 'No token' }

        const res = await fetch(`${API}/api/user/data/${field}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ [field]: data })
        })

        return await res.json()
    } catch (err) {
        console.error('Push field error:', err)
        return { success: false, error: err.message }
    }
}

let timer = null
export const autoSync = async (pantry, favorites, shoppingList, filters) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(async () => {
        const result = await pushToCloud(pantry, favorites, shoppingList, filters)
        if (result.success) console.log('[Sync] Done')
        else console.log('[Sync] Failed:', result.error)
    }, 2000)
}

export const syncToCloud = pushToCloud
export const getCloudData = pullFromCloud
export const syncField = pushField

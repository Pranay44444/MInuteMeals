import * as WebBrowser from 'expo-web-browser'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const API = 'https://crustiest-ilda-anemographically.ngrok-free.dev'

WebBrowser.maybeCompleteAuthSession()

export const login = async () => {
    try {
        const returnUrl = Platform.OS === 'web'
            ? 'http://localhost:8081'
            : 'exp://172.20.10.3:8081/--/auth/callback'

        const result = await WebBrowser.openAuthSessionAsync(`${API}/auth/google`, returnUrl)

        if (result.type === 'success' && result.url) {
            const url = new URL(result.url)
            const token = url.searchParams.get('token')
            const userJson = url.searchParams.get('user')

            if (token && userJson) {
                const user = JSON.parse(userJson)
                await AsyncStorage.setItem('authToken', token)
                await AsyncStorage.setItem('user', JSON.stringify(user))
                return { success: true, user, token }
            }
        }
        return { success: false, error: 'Login failed' }
    } catch (err) {
        console.error('Login error:', err)
        return { success: false, error: err.message }
    }
}

export const logout = async () => {
    try {
        await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' })
        await AsyncStorage.removeItem('user')
        return { success: true }
    } catch (err) {
        console.error('Logout error:', err)
        return { success: false, error: err.message }
    }
}

export const getUser = async () => {
    try {
        const json = await AsyncStorage.getItem('user')
        return json ? JSON.parse(json) : null
    } catch (err) {
        console.error('Get user error:', err)
        return null
    }
}

export const isLoggedIn = async () => {
    const user = await getUser()
    return !!user
}

export const signInWithGoogle = login
export const signOut = logout
export const getCurrentUser = getUser
export const isSignedIn = isLoggedIn

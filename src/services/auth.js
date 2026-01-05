import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import Constants from 'expo-constants'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const API = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000'

WebBrowser.maybeCompleteAuthSession()

export const login = async () => {
    console.log('[Auth] Login started')
    try {
        console.log('[Auth] Checking Platform:', Platform.OS)

        const returnUrl = Platform.OS === 'web'
            ? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081')
            : Linking.createURL('/')

        console.log('[Auth] Return URL:', returnUrl)

        const authUrl = `${API}/auth/google?platform=${Platform.OS}`
        console.log('[Auth] Auth URL:', authUrl)

        console.log('[Auth] Opening session...')
        const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl)
        console.log('[Auth] Result:', JSON.stringify(result))

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

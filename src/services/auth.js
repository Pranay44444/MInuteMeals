import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BACKEND_URL = 'https://crustiest-ilda-anemographically.ngrok-free.dev';

// Initialize WebBrowser for OAuth
WebBrowser.maybeCompleteAuthSession();

/**
 * Sign in with Google OAuth
 */
export const signInWithGoogle = async () => {
    try {
        // Use different return URLs for mobile vs web
        const returnUrl = Platform.OS === 'web'
            ? 'http://localhost:8081'
            : 'exp://172.20.10.3:8081/--/auth/callback';

        // Open Google OAuth in browser
        const result = await WebBrowser.openAuthSessionAsync(
            `${BACKEND_URL}/auth/google`,
            returnUrl
        );

        if (result.type === 'success' && result.url) {
            // Extract token and user from URL
            const url = new URL(result.url);
            const token = url.searchParams.get('token');
            const userJson = url.searchParams.get('user');

            if (token && userJson) {
                const user = JSON.parse(userJson);

                // Save both token and user
                await AsyncStorage.setItem('authToken', token);
                await AsyncStorage.setItem('user', JSON.stringify(user));

                return { success: true, user, token };
            }
        }

        return { success: false, error: 'Authentication failed' };
    } catch (error) {
        console.error('Sign in error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Sign out
 */
export const signOut = async () => {
    try {
        await fetch(`${BACKEND_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });

        await AsyncStorage.removeItem('user');
        return { success: true };
    } catch (error) {
        console.error('Sign out error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get current user from storage
 */
export const getCurrentUser = async () => {
    try {
        const userJson = await AsyncStorage.getItem('user');
        return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
        console.error('Get user error:', error);
        return null;
    }
};

/**
 * Check if user is signed in
 */
export const isSignedIn = async () => {
    const user = await getCurrentUser();
    return !!user;
};

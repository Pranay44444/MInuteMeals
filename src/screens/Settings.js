import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView, StatusBar, ScrollView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { signInWithGoogle, signOut, getCurrentUser, isSignedIn } from '../services/auth';
import { syncToCloud, getCloudData } from '../services/sync';
import { useStore, setPantry, setFavorites, setShoppingList, mergeItems, setInitialSyncComplete, mergeStringArrays } from '../services/store';

export default function Settings() {
    const [user, setUser] = useState(null);
    const [syncing, setSyncing] = useState(false);
    const { state, dispatch } = useStore();

    useEffect(() => {
        checkUser();
    }, []);

    const checkUser = async () => {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
    };

    const handleSignIn = async () => {
        try {
            const result = await signInWithGoogle();
            if (result.success) {
                setUser(result.user);

                // START CLOUD-FIRST RECOVERY
                setSyncing(true);
                console.log('[Sync] 1. Signing In - pulling cloud data...');

                // 1. Force PULL from Cloud
                const cloudData = await getCloudData();

                let restoredPantry = state.pantry.items;
                let restoredFavorites = state.favorites;
                let restoredShopping = state.shoppingList;
                let restoredFilters = state.filters;
                let didRestore = false;

                if (cloudData && !cloudData.error) {
                    console.log('[Sync] 2. Cloud data found. Processing recovery...');

                    // CRITICAL: If Local is empty ( Fresh Install / Clear Data ), ADOPT Cloud Data directly.
                    // Otherwise, MERGE to be safe.
                    const isLocalEmpty = state.pantry.items.length === 0 && state.favorites.length === 0;

                    if (isLocalEmpty) {
                        console.log('[Sync] Local is empty. Overwriting with Cloud Data (Recovery Mode).');
                        if (cloudData.pantry) restoredPantry = cloudData.pantry;
                        if (cloudData.favorites) restoredFavorites = cloudData.favorites;
                        if (cloudData.shoppingList) restoredShopping = cloudData.shoppingList;
                        if (cloudData.filters) restoredFilters = cloudData.filters;
                        didRestore = true;
                    } else {
                        console.log('[Sync] Local has data. Merging Cloud + Local.');
                        // Merge Logic (Safe)
                        if (cloudData.pantry && Array.isArray(cloudData.pantry)) {
                            restoredPantry = mergeStringArrays([...restoredPantry, ...cloudData.pantry]);
                        }
                        if (cloudData.favorites && Array.isArray(cloudData.favorites)) {
                            const distinctFavs = {};
                            [...restoredFavorites, ...cloudData.favorites].forEach(f => {
                                if (f && f.id) distinctFavs[f.id] = f;
                            });
                            restoredFavorites = Object.values(distinctFavs);
                        }
                        if (cloudData.shoppingList && Array.isArray(cloudData.shoppingList)) {
                            restoredShopping = mergeItems([...restoredShopping, ...cloudData.shoppingList]);
                        }
                    }

                    // 3. PERSIST to Disk (AsyncStorage) - Source of Truth
                    await AsyncStorage.multiSet([
                        ['pantry', JSON.stringify(restoredPantry)],
                        ['favorites', JSON.stringify(restoredFavorites)],
                        ['shoppingList', JSON.stringify(restoredShopping)]
                    ]);

                    // 4. UPDATE UI (Store)
                    dispatch(setPantry(restoredPantry));
                    dispatch(setFavorites(restoredFavorites));
                    dispatch(setShoppingList(restoredShopping));

                } else {
                    console.log('[Sync] No cloud data found or error. Treating as new user.');
                }

                // UNLOCK GATEKEEPER: Now we have either recovered data or confirmed fresh user.
                console.log('[Sync] Gatekeeper Unlocked (Sign In).');
                dispatch(setInitialSyncComplete(true));

                // 5. FINAL SYNC (Push back to ensure consistency)
                console.log('[Sync] 5. Finalizing Sync...');
                await syncToCloud(
                    restoredPantry,
                    restoredFavorites,
                    restoredShopping,
                    restoredFilters
                );

                setSyncing(false);

                if (didRestore) {
                    const msg = `Recovered items from cloud:\n• ${restoredPantry.length} Pantry Items\n• ${restoredFavorites.length} Favorites\n• ${restoredShopping.length} Shopping List Items`;
                    if (Platform.OS === 'web') alert(msg);
                    else Alert.alert('Welcome Back!', msg);
                } else {
                    if (Platform.OS === 'web') alert('Signed in successfully!');
                    else Alert.alert('Success', 'Signed in successfully!');
                }

            } else {
                if (Platform.OS === 'web') alert(result.error || 'Sign in failed');
                else Alert.alert('Error', result.error || 'Sign in failed');
            }
        } catch (error) {
            console.error('❌ Sign in error:', error);
            if (Platform.OS === 'web') alert('Failed to sign in');
            else Alert.alert('Error', 'Failed to sign in');
            setSyncing(false);
        }
    };

    const handleSignOut = async () => {
        if (Platform.OS === 'web') {
            if (window.confirm('Are you sure you want to sign out?')) {
                await signOut();
                setUser(null);
                alert('Signed out successfully');
            }
            return;
        }
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        await signOut();
                        setUser(null);
                        Alert.alert('Success', 'Signed out successfully');
                    }
                }
            ]
        );
    };

    const handleSyncNow = async () => {
        setSyncing(true);
        try {
            const result = await syncToCloud(
                state.pantry.items,
                state.favorites,
                state.shoppingList,
                state.filters
            );

            if (result.success) {
                if (Platform.OS === 'web') alert('Data synced to cloud!');
                else Alert.alert('Success', 'Data synced to cloud!');
            } else {
                if (Platform.OS === 'web') alert(result.error || 'Sync failed');
                else Alert.alert('Error', result.error || 'Sync failed');
            }
        } catch (error) {
            if (Platform.OS === 'web') alert('Failed to sync data');
            else Alert.alert('Error', 'Failed to sync data');
        } finally {
            setSyncing(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="white" />
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>Settings</Text>

                {/* User Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>

                    {user ? (
                        <View style={styles.card}>
                            <View style={styles.userInfo}>
                                <Ionicons name="person-circle" size={48} color="#007AFF" />
                                <View style={styles.userDetails}>
                                    <Text style={styles.userName}>{user.name}</Text>
                                    <Text style={styles.userEmail}>{user.email}</Text>
                                    <Text style={styles.syncStatus}>
                                        {syncing ? 'Syncing...' : 'Auto-sync enabled'}
                                    </Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.signOutButton}
                                onPress={handleSignOut}
                            >
                                <Text style={styles.signOutText}>Sign Out</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.card}>
                            <Text style={styles.cardDescription}>
                                Sign in to backup your data and sync across devices
                            </Text>
                            <TouchableOpacity
                                style={styles.signInButton}
                                onPress={handleSignIn}
                            >
                                <Ionicons name="logo-google" size={20} color="white" />
                                <Text style={styles.signInText}>Sign in with Google</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* App Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>About</Text>
                    <View style={styles.card}>
                        <Text style={styles.appName}>MinuteMeals</Text>
                        <Text style={styles.version}>Version 1.0.0</Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    content: {
        padding: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 24,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#666',
        marginBottom: 12,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    userDetails: {
        marginLeft: 12,
        flex: 1,
    },
    userName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    userEmail: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
    syncStatus: {
        fontSize: 12,
        color: '#007AFF',
        marginTop: 6,
        fontWeight: '500',
    },
    syncButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#E3F2FD',
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
    },
    syncButtonText: {
        color: '#007AFF',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    signOutButton: {
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FF3B30',
        alignItems: 'center',
    },
    signOutText: {
        color: '#FF3B30',
        fontSize: 16,
        fontWeight: '600',
    },
    cardDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
        lineHeight: 20,
    },
    signInButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#007AFF',
        padding: 14,
        borderRadius: 8,
    },
    signInText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    appName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        textAlign: 'center',
    },
    version: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginTop: 4,
    },
});

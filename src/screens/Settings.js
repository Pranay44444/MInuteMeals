import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView, StatusBar, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signInWithGoogle, signOut, getCurrentUser, isSignedIn } from '../services/auth';
import { syncToCloud, getCloudData } from '../services/sync';
import { useStore } from '../services/store';

export default function Settings() {
    const [user, setUser] = useState(null);
    const [syncing, setSyncing] = useState(false);
    const { state } = useStore();

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

                // Wait a moment for AsyncStorage data to load into state
                await new Promise(resolve => setTimeout(resolve, 500));

                // Debug: log what we're about to sync
                console.log('📊 Data to sync:');
                console.log('  Pantry:', JSON.stringify(state.pantry.items, null, 2));
                console.log('  Favorites:', JSON.stringify(state.favorites, null, 2));
                console.log('  Shopping List:', JSON.stringify(state.shoppingList, null, 2));
                console.log('  Filters:', JSON.stringify(state.filters, null, 2));

                // Automatically sync local data to cloud
                setSyncing(true);
                const syncResult = await syncToCloud(
                    state.pantry.items,
                    state.favorites,
                    state.shoppingList,
                    state.filters
                );
                setSyncing(false);

                console.log('✅ Sync result:', syncResult);

                if (syncResult.success) {
                    Alert.alert('Success', `Signed in and backed up ${state.pantry.items.length} pantry items, ${state.favorites.length} favorites, ${state.shoppingList.length} shopping items!`);
                } else {
                    Alert.alert('Signed In', `Signed in successfully! Sync issue: ${syncResult.error || 'Unknown'}`);
                }
            } else {
                Alert.alert('Error', result.error || 'Sign in failed');
            }
        } catch (error) {
            console.error('❌ Sign in error:', error);
            Alert.alert('Error', 'Failed to sign in');
            setSyncing(false);
        }
    };

    const handleSignOut = async () => {
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
                Alert.alert('Success', 'Data synced to cloud!');
            } else {
                Alert.alert('Error', result.error || 'Sync failed');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to sync data');
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
                                        {syncing ? '🔄 Syncing...' : '✅ Auto-sync enabled'}
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

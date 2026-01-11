import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView, StatusBar, ScrollView, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { login, logout, getUser } from '../services/auth'
import { pushToCloud, pullFromCloud } from '../services/sync'
import { useStore, setPantry, setFavorites, setShoppingList, mergeItems, setInitialSyncComplete, mergeStringArrays } from '../services/store'

export default function Settings() {
    const [user, setUser] = useState(null)
    const [syncing, setSyncing] = useState(false)
    const [deferredPrompt, setDeferredPrompt] = useState(null)
    const { state, dispatch } = useStore()

    useEffect(() => {
        loadUser()
        if (Platform.OS === 'web') {
            const handler = (e) => {
                e.preventDefault()
                setDeferredPrompt(e)
            }
            window.addEventListener('beforeinstallprompt', handler)
            return () => window.removeEventListener('beforeinstallprompt', handler)
        }
    }, [])

    const loadUser = async () => {
        const u = await getUser()
        setUser(u)
    }

    const doLogin = async () => {
        try {
            const result = await login()
            if (result.success) {
                setUser(result.user)
                setSyncing(true)
                console.log('[Sync] Pulling cloud data...')

                const cloud = await pullFromCloud()

                let pantry = state.pantry.items
                let favs = state.favorites
                let shopping = state.shoppingList
                let filters = state.filters
                let restored = false

                if (cloud && !cloud.error) {
                    const isEmpty = state.pantry.items.length === 0 && state.favorites.length === 0

                    if (isEmpty) {
                        console.log('[Sync] Using cloud data')
                        if (cloud.pantry) pantry = cloud.pantry
                        if (cloud.favorites) favs = cloud.favorites
                        if (cloud.shoppingList) shopping = cloud.shoppingList
                        if (cloud.filters) filters = cloud.filters
                        restored = true
                    } else {
                        console.log('[Sync] Merging data')
                        if (cloud.pantry && Array.isArray(cloud.pantry)) pantry = mergeStringArrays([...pantry, ...cloud.pantry])
                        if (cloud.favorites && Array.isArray(cloud.favorites)) {
                            const map = {}
                                ;[...favs, ...cloud.favorites].forEach(f => { if (f && f.id) map[f.id] = f })
                            favs = Object.values(map)
                        }
                        if (cloud.shoppingList && Array.isArray(cloud.shoppingList)) shopping = mergeItems([...shopping, ...cloud.shoppingList])
                    }

                    await AsyncStorage.multiSet([
                        ['pantry', JSON.stringify(pantry)],
                        ['favorites', JSON.stringify(favs)],
                        ['shoppingList', JSON.stringify(shopping)]
                    ])

                    dispatch(setPantry(pantry))
                    dispatch(setFavorites(favs))
                    dispatch(setShoppingList(shopping))
                }

                dispatch(setInitialSyncComplete(true))
                await pushToCloud(pantry, favs, shopping, filters)
                setSyncing(false)

                if (restored) {
                    const msg = `Recovered: ${pantry.length} pantry, ${favs.length} favorites, ${shopping.length} shopping`
                    Platform.OS === 'web' ? alert(msg) : Alert.alert('Welcome Back!', msg)
                } else {
                    Platform.OS === 'web' ? alert('Signed in!') : Alert.alert('Success', 'Signed in!')
                }
            } else {
                Platform.OS === 'web' ? alert(result.error || 'Login failed') : Alert.alert('Error', result.error || 'Login failed')
            }
        } catch (err) {
            console.error('Login error:', err)
            Platform.OS === 'web' ? alert('Failed to sign in') : Alert.alert('Error', 'Failed to sign in')
            setSyncing(false)
        }
    }

    const doLogout = async () => {
        if (Platform.OS === 'web') {
            if (window.confirm('Sign out?')) {
                await logout()
                setUser(null)
                alert('Signed out')
            }
            return
        }
        Alert.alert('Sign Out', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign Out', style: 'destructive', onPress: async () => {
                    await logout()
                    setUser(null)
                    Alert.alert('Success', 'Signed out')
                }
            }
        ])
    }

    const doSync = async () => {
        setSyncing(true)
        try {
            const result = await pushToCloud(state.pantry.items, state.favorites, state.shoppingList, state.filters)
            if (result.success) {
                Platform.OS === 'web' ? alert('Synced!') : Alert.alert('Success', 'Synced!')
            } else {
                Platform.OS === 'web' ? alert(result.error || 'Sync failed') : Alert.alert('Error', result.error || 'Sync failed')
            }
        } catch (err) {
            Platform.OS === 'web' ? alert('Sync failed') : Alert.alert('Error', 'Sync failed')
        } finally {
            setSyncing(false)
        }
    }

    return (
        <SafeAreaView style={styles.main}>
            <StatusBar barStyle="dark-content" backgroundColor="white" />
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>Settings</Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    {user ? (
                        <View style={styles.card}>
                            <View style={styles.row}>
                                <Ionicons name="person-circle" size={48} color="#007AFF" />
                                <View style={styles.info}>
                                    <Text style={styles.name}>{user.name}</Text>
                                    <Text style={styles.email}>{user.email}</Text>
                                    <Text style={styles.status}>{syncing ? 'Syncing...' : 'Auto-sync enabled'}</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={styles.outBtn} onPress={doLogout}>
                                <Text style={styles.outText}>Sign Out</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.card}>
                            <Text style={styles.desc}>Sign in to backup your data and sync across devices</Text>
                            <TouchableOpacity style={styles.inBtn} onPress={doLogin}>
                                <Ionicons name="logo-google" size={20} color="white" />
                                <Text style={styles.inText}>Sign in with Google</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>About</Text>
                    <View style={styles.card}>
                        <Text style={styles.appName}>MinuteMeals</Text>
                        <Text style={styles.version}>Version 1.0.0</Text>
                        {deferredPrompt && (
                            <TouchableOpacity style={styles.installBtn} onPress={async () => {
                                deferredPrompt.prompt()
                                const { outcome } = await deferredPrompt.userChoice
                                if (outcome === 'accepted') setDeferredPrompt(null)
                            }}>
                                <Ionicons name="download" size={20} color="white" />
                                <Text style={styles.installText}>Install App</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    main: { flex: 1, backgroundColor: '#f8f9fa', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
    content: { padding: 16 },
    title: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 24 },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: '#666', marginBottom: 12 },
    card: { backgroundColor: 'white', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    info: { marginLeft: 12, flex: 1 },
    name: { fontSize: 18, fontWeight: '600', color: '#333' },
    email: { fontSize: 14, color: '#666', marginTop: 4 },
    status: { fontSize: 12, color: '#007AFF', marginTop: 6, fontWeight: '500' },
    outBtn: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FF3B30', alignItems: 'center' },
    outText: { color: '#FF3B30', fontSize: 16, fontWeight: '600' },
    desc: { fontSize: 14, color: '#666', marginBottom: 16, lineHeight: 20 },
    inBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#007AFF', padding: 14, borderRadius: 8 },
    inText: { color: 'white', fontSize: 16, fontWeight: '600', marginLeft: 8 },
    appName: { fontSize: 18, fontWeight: '600', color: '#333', textAlign: 'center' },
    version: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 4 },
    installBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#34C759', padding: 12, borderRadius: 8, marginTop: 16 },
    installText: { color: 'white', fontSize: 16, fontWeight: '600', marginLeft: 8 }
})

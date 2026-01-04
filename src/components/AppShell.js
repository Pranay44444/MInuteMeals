import React, { useEffect } from 'react'
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native'

const AppShell = ({ children }) => {
    const { width } = useWindowDimensions()
    const isMobile = Platform.OS === 'web' && width < 400
    const isDesktop = Platform.OS === 'web' && width >= 400

    useEffect(() => {
        if (Platform.OS !== 'web') return
        if (typeof document !== 'undefined') {
            const style = document.createElement('style')
            style.id = 'app-shell-styles'
            style.textContent = `html, body, #root { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; }`
            const existing = document.getElementById('app-shell-styles')
            if (existing) existing.remove()
            document.head.appendChild(style)
        }
    }, [])

    useEffect(() => {
        if (Platform.OS !== 'web' || typeof document === 'undefined') return
        document.body.style.backgroundColor = isDesktop ? '#000' : '#f8f9fa'
    }, [isDesktop])

    if (Platform.OS !== 'web') return children

    if (isMobile) return <View style={styles.mobile}>{children}</View>

    return (
        <View style={styles.outer}>
            <View style={styles.frame}>
                <View style={styles.notch}><View style={styles.island} /></View>
                <View style={styles.screen}>{children}</View>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    mobile: { width: '100%', height: '100%', flex: 1, backgroundColor: '#f8f9fa' },
    outer: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#000', overflow: 'hidden' },
    frame: { width: 400, height: '95vh', backgroundColor: '#f8f9fa', borderRadius: 50, borderWidth: 8, borderColor: '#1a1a1a', overflow: 'hidden', alignSelf: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.5, shadowRadius: 60, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },
    notch: { height: 48, backgroundColor: '#f8f9fa', alignItems: 'center', justifyContent: 'center', paddingTop: 8 },
    island: { width: 120, height: 35, backgroundColor: '#000', borderRadius: 18 },
    screen: { flex: 1, backgroundColor: '#f8f9fa', overflow: 'hidden' }
})

export default AppShell

import React, { useEffect } from 'react'
import { View, StyleSheet, Platform, useWindowDimensions, Text, TouchableOpacity } from 'react-native'

const AppShell = ({ children }) => {
    const { width } = useWindowDimensions()
    const isMobile = Platform.OS === 'web' && width < 768
    const isDesktop = Platform.OS === 'web' && width >= 768

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

    // PWA Install Logic
    const [deferredPrompt, setDeferredPrompt] = React.useState(null)
    const [showIos, setShowIos] = React.useState(false) // For iOS tooltip
    const [isIos, setIsIos] = React.useState(false)

    React.useEffect(() => {
        if (Platform.OS === 'web') {
            // Android / Desktop Chrome
            const handler = (e) => {
                e.preventDefault()
                setDeferredPrompt(e)
            }
            window.addEventListener('beforeinstallprompt', handler)

            // iOS Detection
            const userAgent = window.navigator.userAgent.toLowerCase()
            const isIosDevice = /iphone|ipad|ipod/.test(userAgent)
            const isInStandalone = window.navigator.standalone === true
            setIsIos(isIosDevice && !isInStandalone)

            return () => window.removeEventListener('beforeinstallprompt', handler)
        }
    }, [])

    if (Platform.OS !== 'web') return children

    return (
        <>
            {isMobile ? (
                <View style={styles.mobile}>{children}</View>
            ) : (
                <View style={styles.outer}>
                    <View style={styles.frame}>
                        <View style={styles.notch}><View style={styles.island} /></View>
                        <View style={styles.screen}>{children}</View>
                    </View>
                </View>
            )}

            {/* Floating Install Banner */}
            {(deferredPrompt || isIos) && (
                <View style={styles.banner}>
                    <View style={styles.bannerContent}>
                        <TouchableOpacity style={styles.closeBtn} onPress={() => {
                            setDeferredPrompt(null)
                            setIsIos(false)
                        }}>
                            <Text style={styles.closeText}>×</Text>
                        </TouchableOpacity>

                        <View style={styles.iconBox}>
                            <View style={styles.appIcon} />
                        </View>
                        <View style={styles.bannerText}>
                            <Text style={styles.bannerTitle}>Install MinuteMeals</Text>
                            <Text style={styles.bannerSub}>Add to home screen for better experience</Text>
                        </View>
                        <TouchableOpacity style={styles.bannerBtn} onPress={async () => {
                            if (deferredPrompt) {
                                deferredPrompt.prompt()
                                const { outcome } = await deferredPrompt.userChoice
                                if (outcome === 'accepted') setDeferredPrompt(null)
                            } else if (isIos) {
                                setShowIos(prev => !prev) // Toggle Tooltip
                            }
                        }}>
                            <Text style={styles.bannerBtnText}>Install</Text>
                        </TouchableOpacity>
                    </View>
                    {/* iOS Tooltip */}
                    {showIos && (
                        <View style={styles.tooltip}>
                            <Text style={styles.tooltipText}>Tap <Text style={{ fontWeight: 'bold' }}>Share</Text> button below</Text>
                            <Text style={styles.tooltipText}>Then <Text style={{ fontWeight: 'bold' }}>Add to Home Screen</Text></Text>
                            <View style={styles.arrow} />
                        </View>
                    )}
                </View>
            )}
        </>
    )
}

const styles = StyleSheet.create({
    mobile: { width: '100%', height: '100%', flex: 1, backgroundColor: '#f8f9fa' },
    outer: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#000', overflow: 'hidden' },
    frame: { width: 400, height: '95vh', backgroundColor: '#f8f9fa', borderRadius: 50, borderWidth: 8, borderColor: '#1a1a1a', overflow: 'hidden', alignSelf: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.5, shadowRadius: 60, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },
    notch: { height: 48, backgroundColor: '#f8f9fa', alignItems: 'center', justifyContent: 'center', paddingTop: 8 },
    island: { width: 120, height: 35, backgroundColor: '#000', borderRadius: 18 },
    screen: { flex: 1, backgroundColor: '#f8f9fa', overflow: 'hidden' },
    banner: { position: 'absolute', top: 10, left: 10, right: 10, backgroundColor: 'rgba(30,30,30,0.95)', borderRadius: 12, padding: 12, backdropFilter: 'blur(10px)', zIndex: 9999, maxWidth: 600, alignSelf: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    bannerContent: { flexDirection: 'row', alignItems: 'center' },
    closeBtn: { padding: 4, marginRight: 8 },
    closeText: { color: '#888', fontSize: 24, lineHeight: 24, fontWeight: '300' },
    iconBox: { width: 36, height: 36, backgroundColor: '#ff9500', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    appIcon: { width: 20, height: 20, backgroundColor: 'white', borderRadius: 10 },
    bannerText: { flex: 1 },
    bannerTitle: { color: 'white', fontWeight: 'bold', fontSize: 13 },
    bannerSub: { color: '#ccc', fontSize: 11 },
    bannerBtn: { backgroundColor: '#ff9500', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
    bannerBtnText: { color: 'white', fontWeight: 'bold', fontSize: 11 },
    tooltip: { position: 'absolute', top: 55, right: 0, backgroundColor: 'white', padding: 12, borderRadius: 8, width: 200, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8 },
    tooltipText: { fontSize: 13, color: '#333', marginBottom: 2 },
    arrow: { position: 'absolute', top: -6, right: 20, width: 12, height: 12, backgroundColor: 'white', transform: [{ rotate: '45deg' }] }
})

export default AppShell

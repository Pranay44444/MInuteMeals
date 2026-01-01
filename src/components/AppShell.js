import React, { useEffect } from 'react'
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native'

const AppShell = ({ children }) => {
    const { width } = useWindowDimensions()

    // Smart detection: 
    // - Native app = always full screen
    // - Mobile web (< 400px) = full screen
    // - Desktop web (>= 400px) = centered phone mockup
    const isMobileWeb = Platform.OS === 'web' && width < 400
    const isDesktop = Platform.OS === 'web' && width >= 400

    useEffect(() => {
        // Only apply web-specific styling
        if (Platform.OS !== 'web') return

        // Inject global CSS
        if (typeof document !== 'undefined') {
            const style = document.createElement('style')
            style.id = 'app-shell-styles'
            style.textContent = `
        html, body, #root {
          margin: 0;
          padding: 0;
          height: 100%;
          width: 100%;
          overflow: hidden;
        }
      `

            // Remove existing style if present
            const existing = document.getElementById('app-shell-styles')
            if (existing) existing.remove()

            document.head.appendChild(style)
        }
    }, [])

    // Update body background based on view mode
    useEffect(() => {
        if (Platform.OS !== 'web' || typeof document === 'undefined') return

        document.body.style.backgroundColor = isDesktop ? '#000000' : '#f8f9fa'
    }, [isDesktop])

    // For native platforms, render children directly
    if (Platform.OS !== 'web') {
        return children
    }

    // Mobile Web (< 400px): Full screen, no frame
    if (isMobileWeb) {
        return (
            <View style={styles.mobileContainer}>
                {children}
            </View>
        )
    }

    // Desktop Web (>= 400px): Sleek centered phone mockup
    return (
        <View style={styles.desktopOuter}>
            <View style={styles.desktopFrame}>
                {/* Dynamic Island */}
                <View style={styles.notchArea}>
                    <View style={styles.dynamicIsland} />
                </View>

                {/* App Content */}
                <View style={styles.screenContent}>
                    {children}
                </View>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    // Mobile Web - Full Screen
    mobileContainer: {
        width: '100%',
        height: '100%',
        flex: 1,
        backgroundColor: '#f8f9fa',
    },

    // Desktop Web - Centered Floating Phone
    desktopOuter: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#000000',
        overflow: 'hidden',
    },
    desktopFrame: {
        width: 400,
        height: '95vh',
        backgroundColor: '#f8f9fa',
        borderRadius: 50,
        borderWidth: 8,
        borderColor: '#1a1a1a',
        overflow: 'hidden',
        alignSelf: 'center',
        // Professional shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.5,
        shadowRadius: 60,
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
    },
    notchArea: {
        height: 48,
        backgroundColor: '#f8f9fa',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 8,
    },
    dynamicIsland: {
        width: 120,
        height: 35,
        backgroundColor: '#000000',
        borderRadius: 18,
    },
    screenContent: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        overflow: 'hidden',
    },
})

export default AppShell

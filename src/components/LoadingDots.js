import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'

export const LoadingDots = ({ text = 'Loading', color = '#666' }) => {
    const d1 = useRef(new Animated.Value(0)).current
    const d2 = useRef(new Animated.Value(0)).current
    const d3 = useRef(new Animated.Value(0)).current

    useEffect(() => {
        const anim = (d, delay) => Animated.sequence([
            Animated.delay(delay),
            Animated.timing(d, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(d, { toValue: 0, duration: 400, useNativeDriver: true })
        ])

        const loop = Animated.loop(Animated.parallel([anim(d1, 0), anim(d2, 200), anim(d3, 400)]))
        loop.start()
        return () => loop.stop()
    }, [d1, d2, d3])

    const dotStyle = (d) => ({
        opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
        transform: [{ scale: d.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.1] }) }]
    })

    return (
        <View style={styles.main}>
            <Text style={[styles.text, { color }]}>{text}</Text>
            <View style={styles.dots}>
                <Animated.Text style={[styles.dot, { color }, dotStyle(d1)]}>●</Animated.Text>
                <Animated.Text style={[styles.dot, { color }, dotStyle(d2)]}>●</Animated.Text>
                <Animated.Text style={[styles.dot, { color }, dotStyle(d3)]}>●</Animated.Text>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    main: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    text: { fontSize: 16, marginRight: 4 },
    dots: { flexDirection: 'row', alignItems: 'center' },
    dot: { fontSize: 12, marginHorizontal: 1 }
})

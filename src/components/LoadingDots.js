import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'

export const LoadingDots = ({ text = 'Loading', color = '#666' }) => {
    const dot1 = useRef(new Animated.Value(0)).current
    const dot2 = useRef(new Animated.Value(0)).current
    const dot3 = useRef(new Animated.Value(0)).current

    useEffect(() => {
        const animateDot = (dotValue, delay) => {
            return Animated.sequence([
                Animated.delay(delay),
                Animated.timing(dotValue, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
                Animated.timing(dotValue, {
                    toValue: 0,
                    duration: 400,
                    useNativeDriver: true,
                }),
            ])
        }

        const loopAnimation = Animated.loop(
            Animated.parallel([
                animateDot(dot1, 0),
                animateDot(dot2, 200),
                animateDot(dot3, 400),
            ])
        )

        loopAnimation.start()

        return () => loopAnimation.stop()
    }, [dot1, dot2, dot3])

    const dotStyle = (dotValue) => ({
        opacity: dotValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0.3, 1],
        }),
        transform: [
            {
                scale: dotValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1.1],
                }),
            },
        ],
    })

    return (
        <View style={styles.container}>
            <Text style={[styles.text, { color }]}>{text}</Text>
            <View style={styles.dotsContainer}>
                <Animated.Text style={[styles.dot, { color }, dotStyle(dot1)]}>
                    ●
                </Animated.Text>
                <Animated.Text style={[styles.dot, { color }, dotStyle(dot2)]}>
                    ●
                </Animated.Text>
                <Animated.Text style={[styles.dot, { color }, dotStyle(dot3)]}>
                    ●
                </Animated.Text>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        fontSize: 16,
        marginRight: 4,
    },
    dotsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dot: {
        fontSize: 12,
        marginHorizontal: 1,
    },
})

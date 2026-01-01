import React, { useRef, useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

const WebCameraCapture = ({ visible, onCapture, onClose }) => {
    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const fileInputRef = useRef(null)
    const [stream, setStream] = useState(null)
    const [error, setError] = useState(null)
    const [useFileInput, setUseFileInput] = useState(false)
    const [cameraKey, setCameraKey] = useState(0)

    useEffect(() => {
        if (visible && Platform.OS === 'web') {
            // Check if we can use getUserMedia (requires HTTPS)
            const isSecure = typeof window !== 'undefined' && (
                window.isSecureContext ||
                window.location.protocol === 'https:' ||
                window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1'
            )

            if (isSecure) {
                startCamera()
            } else {
                // Fall back to file input on HTTP
                setUseFileInput(true)
            }
        }
        return () => {
            stopCamera()
        }
    }, [visible])

    const startCamera = async () => {
        try {
            setError(null)
            setUseFileInput(false)

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                setUseFileInput(true)
                return
            }

            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            })

            setStream(mediaStream)
            setCameraKey(k => k + 1)

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream
                await videoRef.current.play()
            }
        } catch (err) {
            console.error('Camera error:', err)
            // Fall back to file input on any error
            setUseFileInput(true)
        }
    }

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop())
            setStream(null)
        }
    }

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return

        const video = videoRef.current
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0, canvas.width, canvas.height)

        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8)
        stopCamera()
        onCapture(imageDataUrl)
    }

    const handleFileSelect = (event) => {
        const file = event.target.files?.[0]
        if (!file) return

        // Create an image element to resize/compress
        const img = new Image()
        img.onload = () => {
            // Target max dimension (smaller = faster upload/processing)
            const MAX_SIZE = 1024
            let width = img.width
            let height = img.height

            // Calculate new dimensions while maintaining aspect ratio
            if (width > height && width > MAX_SIZE) {
                height = Math.round((height * MAX_SIZE) / width)
                width = MAX_SIZE
            } else if (height > MAX_SIZE) {
                width = Math.round((width * MAX_SIZE) / height)
                height = MAX_SIZE
            }

            // Create canvas for resizing
            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0, width, height)

            // Convert to compressed JPEG (0.7 quality for speed)
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7)
            console.log(`[Web] Image resized: ${img.width}x${img.height} → ${width}x${height}`)
            onCapture(compressedDataUrl)
        }

        // Read the file
        const reader = new FileReader()
        reader.onload = (e) => {
            img.src = e.target.result
        }
        reader.readAsDataURL(file)
    }

    const triggerFileInput = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click()
        }
    }

    const handleClose = () => {
        stopCamera()
        onClose()
    }

    if (Platform.OS !== 'web') {
        return null
    }

    return (
        <Modal
            visible={visible}
            animationType="slide"
            onRequestClose={handleClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Scan Ingredients</Text>
                    <View style={styles.placeholder} />
                </View>

                {/* Camera View or File Input */}
                <View style={styles.cameraContainer}>
                    {useFileInput ? (
                        // File Input Mode (works on HTTP)
                        <View style={styles.fileInputContainer}>
                            <Ionicons name="camera" size={80} color="#007AFF" />
                            <Text style={styles.fileInputTitle}>Take a Photo</Text>
                            <Text style={styles.fileInputHint}>
                                Tap below to open your camera and take a photo of your ingredients
                            </Text>

                            <TouchableOpacity style={styles.takePhotoBtn} onPress={triggerFileInput}>
                                <Ionicons name="camera-outline" size={24} color="#fff" />
                                <Text style={styles.takePhotoBtnText}>Open Camera</Text>
                            </TouchableOpacity>

                            {/* Hidden file input with camera capture */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handleFileSelect}
                                style={{ display: 'none' }}
                            />

                            <TouchableOpacity
                                style={styles.galleryBtn}
                                onPress={() => {
                                    if (fileInputRef.current) {
                                        fileInputRef.current.removeAttribute('capture')
                                        fileInputRef.current.click()
                                    }
                                }}
                            >
                                <Ionicons name="images-outline" size={20} color="#007AFF" />
                                <Text style={styles.galleryBtnText}>Choose from Gallery</Text>
                            </TouchableOpacity>
                        </View>
                    ) : error ? (
                        <View style={styles.errorContainer}>
                            <Ionicons name="camera-outline" size={64} color="#ccc" />
                            <Text style={styles.errorText}>{error}</Text>
                            <TouchableOpacity style={styles.retryBtn} onPress={() => setUseFileInput(true)}>
                                <Text style={styles.retryBtnText}>Use File Input Instead</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            <video
                                key={cameraKey}
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                style={styles.video}
                            />
                            <canvas ref={canvasRef} style={styles.canvas} />
                        </>
                    )}
                </View>

                {/* Capture Button (only for live camera mode) */}
                {!useFileInput && !error && (
                    <View style={styles.controls}>
                        <TouchableOpacity style={styles.captureBtn} onPress={capturePhoto}>
                            <View style={styles.captureBtnInner} />
                        </TouchableOpacity>
                        <Text style={styles.captureHint}>Point camera at ingredients and tap to capture</Text>
                    </View>
                )}
            </View>
        </Modal>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        paddingTop: 50,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    closeBtn: {
        padding: 8,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    placeholder: {
        width: 44,
    },
    cameraContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    video: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    canvas: {
        display: 'none',
    },
    // File Input Styles
    fileInputContainer: {
        alignItems: 'center',
        padding: 40,
    },
    fileInputTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '600',
        marginTop: 20,
        marginBottom: 10,
    },
    fileInputHint: {
        color: '#999',
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 22,
        paddingHorizontal: 20,
    },
    takePhotoBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#007AFF',
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    takePhotoBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 10,
    },
    galleryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#007AFF',
    },
    galleryBtnText: {
        color: '#007AFF',
        fontSize: 16,
        marginLeft: 8,
    },
    // Error Styles
    errorContainer: {
        alignItems: 'center',
        padding: 40,
    },
    errorText: {
        color: '#999',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 16,
        lineHeight: 24,
    },
    retryBtn: {
        marginTop: 20,
        backgroundColor: '#007AFF',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    // Capture Controls
    controls: {
        padding: 24,
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    captureBtn: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: '#fff',
    },
    captureBtnInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#fff',
    },
    captureHint: {
        color: '#fff',
        fontSize: 14,
        marginTop: 16,
        textAlign: 'center',
    },
})

export default WebCameraCapture

import React, { useRef, useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

const WebCameraCapture = ({ visible, onCapture, onClose }) => {
    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const fileRef = useRef(null)
    const [stream, setStream] = useState(null)
    const [err, setErr] = useState(null)
    const [useFile, setUseFile] = useState(false)
    const [key, setKey] = useState(0)

    useEffect(() => {
        if (visible && Platform.OS === 'web') {
            const secure = typeof window !== 'undefined' && (window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            secure ? startCam() : setUseFile(true)
        }
        return () => stopCam()
    }, [visible])

    const startCam = async () => {
        try {
            setErr(null)
            setUseFile(false)
            if (!navigator.mediaDevices?.getUserMedia) { setUseFile(true); return }
            const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } })
            setStream(s)
            setKey(k => k + 1)
            if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play() }
        } catch (e) { console.error('Camera error:', e); setUseFile(true) }
    }

    const stopCam = () => { if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null) } }

    const capture = () => {
        if (!videoRef.current || !canvasRef.current) return
        const v = videoRef.current, c = canvasRef.current, ctx = c.getContext('2d')
        c.width = v.videoWidth; c.height = v.videoHeight
        ctx.drawImage(v, 0, 0, c.width, c.height)
        const url = c.toDataURL('image/jpeg', 0.8)
        stopCam(); onCapture(url)
    }

    const onFile = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        const img = new Image()
        img.onload = () => {
            const MAX = 1024
            let w = img.width, h = img.height
            if (w > h && w > MAX) { h = Math.round((h * MAX) / w); w = MAX }
            else if (h > MAX) { w = Math.round((w * MAX) / h); h = MAX }
            const c = document.createElement('canvas')
            c.width = w; c.height = h
            c.getContext('2d').drawImage(img, 0, 0, w, h)
            onCapture(c.toDataURL('image/jpeg', 0.7))
        }
        const r = new FileReader()
        r.onload = (e) => { img.src = e.target.result }
        r.readAsDataURL(file)
    }

    const openFile = () => { if (fileRef.current) fileRef.current.click() }
    const close = () => { stopCam(); onClose() }

    if (Platform.OS !== 'web') return null

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={close}>
            <View style={styles.main}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={close} style={styles.closeBtn}><Ionicons name="close" size={28} color="#fff" /></TouchableOpacity>
                    <Text style={styles.title}>Scan Ingredients</Text>
                    <View style={styles.spacer} />
                </View>
                <View style={styles.camBox}>
                    {useFile ? (
                        <View style={styles.fileBox}>
                            <Ionicons name="camera" size={80} color="#007AFF" />
                            <Text style={styles.fileTitle}>Take a Photo</Text>
                            <Text style={styles.fileHint}>Tap below to open your camera</Text>
                            <TouchableOpacity style={styles.photoBtn} onPress={openFile}><Ionicons name="camera-outline" size={24} color="#fff" /><Text style={styles.photoBtnText}>Open Camera</Text></TouchableOpacity>
                            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: 'none' }} />
                            <TouchableOpacity style={styles.galleryBtn} onPress={() => { if (fileRef.current) { fileRef.current.removeAttribute('capture'); fileRef.current.click() } }}>
                                <Ionicons name="images-outline" size={20} color="#007AFF" /><Text style={styles.galleryText}>Choose from Gallery</Text>
                            </TouchableOpacity>
                        </View>
                    ) : err ? (
                        <View style={styles.errBox}><Ionicons name="camera-outline" size={64} color="#ccc" /><Text style={styles.errText}>{err}</Text><TouchableOpacity style={styles.retryBtn} onPress={() => setUseFile(true)}><Text style={styles.retryText}>Use File Input</Text></TouchableOpacity></View>
                    ) : (
                        <><video key={key} ref={videoRef} autoPlay playsInline muted style={styles.video} /><canvas ref={canvasRef} style={styles.canvas} /></>
                    )}
                </View>
                {!useFile && !err && (
                    <View style={styles.controls}>
                        <TouchableOpacity style={styles.captureBtn} onPress={capture}><View style={styles.captureBtnInner} /></TouchableOpacity>
                        <Text style={styles.hint}>Point camera at ingredients and tap to capture</Text>
                    </View>
                )}
            </View>
        </Modal>
    )
}

const styles = StyleSheet.create({
    main: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 50, backgroundColor: 'rgba(0,0,0,0.5)' },
    closeBtn: { padding: 8 },
    title: { color: '#fff', fontSize: 18, fontWeight: '600' },
    spacer: { width: 44 },
    camBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    video: { width: '100%', height: '100%', objectFit: 'cover' },
    canvas: { display: 'none' },
    fileBox: { alignItems: 'center', padding: 40 },
    fileTitle: { color: '#fff', fontSize: 24, fontWeight: '600', marginTop: 20, marginBottom: 10 },
    fileHint: { color: '#999', fontSize: 15, textAlign: 'center', marginBottom: 30, lineHeight: 22, paddingHorizontal: 20 },
    photoBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#007AFF', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12, marginBottom: 16 },
    photoBtnText: { color: '#fff', fontSize: 18, fontWeight: '600', marginLeft: 10 },
    galleryBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#007AFF' },
    galleryText: { color: '#007AFF', fontSize: 16, marginLeft: 8 },
    errBox: { alignItems: 'center', padding: 40 },
    errText: { color: '#999', fontSize: 16, textAlign: 'center', marginTop: 16, lineHeight: 24 },
    retryBtn: { marginTop: 20, backgroundColor: '#007AFF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
    retryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    controls: { padding: 24, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    captureBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#fff' },
    captureBtnInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
    hint: { color: '#fff', fontSize: 14, marginTop: 16, textAlign: 'center' }
})

export default WebCameraCapture

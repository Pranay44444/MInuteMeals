import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export const Snackbar = ({ visible, message, actionText, onActionPress, onDismiss, duration = 4000 }) => {
  const [up, setUp] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (visible) {
      setShow(true)
      setTimeout(() => setUp(true), 50)
      const t = setTimeout(() => hide(), duration)
      return () => clearTimeout(t)
    } else {
      hide()
    }
  }, [visible, duration])

  const hide = () => {
    setUp(false)
    setTimeout(() => { setShow(false); if (onDismiss) onDismiss() }, 300)
  }

  if (!show) return null

  return (
    <View style={[styles.main, up ? styles.up : styles.down]}>
      <View style={styles.box}>
        <Text style={styles.text}>{message}</Text>
        <View style={styles.btns}>
          {actionText && onActionPress && <TouchableOpacity onPress={onActionPress} style={styles.action}><Text style={styles.actionText}>{actionText}</Text></TouchableOpacity>}
          <TouchableOpacity onPress={hide} style={styles.close}><Ionicons name="close" size={20} color="white" /></TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  main: { position: 'absolute', bottom: 20, left: 16, right: 16, zIndex: 1000 },
  up: { transform: [{ translateY: 0 }], opacity: 1 },
  down: { transform: [{ translateY: 100 }], opacity: 0 },
  box: { backgroundColor: '#333', borderRadius: 8, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  text: { color: 'white', fontSize: 14, flex: 1, marginRight: 12 },
  btns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  action: { paddingHorizontal: 12, paddingVertical: 6 },
  actionText: { color: '#007AFF', fontSize: 14, fontWeight: '600' },
  close: { padding: 4 }
})

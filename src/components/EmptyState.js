import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export const EmptyState = ({ icon = "document-outline", title = "Nothing here yet", description = "Add some items to get started", actionText, onActionPress, style }) => {
  return (
    <View style={[styles.main, style]}>
      <View style={styles.iconBox}><Ionicons name={icon} size={64} color="#ccc" /></View>
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.desc}>{description}</Text>}
      {actionText && onActionPress && <TouchableOpacity style={styles.btn} onPress={onActionPress}><Text style={styles.btnText}>{actionText}</Text></TouchableOpacity>}
    </View>
  )
}

const styles = StyleSheet.create({
  main: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 64 },
  iconBox: { marginBottom: 24 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#666', textAlign: 'center', marginBottom: 8 },
  desc: { fontSize: 16, color: '#999', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  btn: { backgroundColor: '#007AFF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 25 },
  btnText: { color: 'white', fontSize: 16, fontWeight: '600' }
})

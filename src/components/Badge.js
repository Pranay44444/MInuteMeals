import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

export const Badge = ({ text, variant = 'default', size = 'medium', style }) => {
  const bg = { success: styles.green, warning: styles.yellow, error: styles.red, info: styles.blue, cookNow: styles.cook, missing: styles.miss }[variant] || styles.gray
  const color = { success: styles.greenTxt, warning: styles.yellowTxt, error: styles.redTxt, info: styles.blueTxt, cookNow: styles.cookTxt, missing: styles.missTxt }[variant] || styles.grayTxt
  const sz = { small: styles.sm, large: styles.lg }[size] || styles.md
  const txtSz = { small: styles.smTxt, large: styles.lgTxt }[size] || styles.mdTxt

  return (
    <View style={[styles.main, bg, sz, style]}>
      <Text style={[styles.text, color, txtSz]}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  main: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  text: { fontWeight: '600', textAlign: 'center' },
  sm: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  md: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  lg: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  smTxt: { fontSize: 10 },
  mdTxt: { fontSize: 12 },
  lgTxt: { fontSize: 14 },
  gray: { backgroundColor: '#f0f0f0' },
  grayTxt: { color: '#666' },
  green: { backgroundColor: '#d4edda' },
  greenTxt: { color: '#155724' },
  yellow: { backgroundColor: '#fff3cd' },
  yellowTxt: { color: '#856404' },
  red: { backgroundColor: '#f8d7da' },
  redTxt: { color: '#721c24' },
  blue: { backgroundColor: '#cce7ff' },
  blueTxt: { color: '#004085' },
  cook: { backgroundColor: '#28a745' },
  cookTxt: { color: 'white' },
  miss: { backgroundColor: '#ffc107' },
  missTxt: { color: '#212529' }
})

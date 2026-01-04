import React from 'react'
import { View, StyleSheet } from 'react-native'

export const RecipeSkeleton = () => {
  const [bright, setBright] = React.useState(true)

  React.useEffect(() => {
    const t = setInterval(() => setBright(p => !p), 1000)
    return () => clearInterval(t)
  }, [])

  const Box = ({ style }) => <View style={[styles.glow, bright ? styles.on : styles.off, style]} />

  return (
    <View style={styles.main}>
      <View style={styles.img}><Box style={styles.imgBox} /></View>
      <View style={styles.box}>
        <Box style={styles.title} />
        <Box style={styles.sub} />
        <View style={styles.row}><Box style={styles.item} /><Box style={styles.item} /><Box style={styles.item} /></View>
        <View style={styles.badges}><Box style={styles.badge} /><Box style={styles.badge} /></View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  main: { backgroundColor: 'white', borderRadius: 12, marginHorizontal: 16, marginVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, overflow: 'hidden' },
  img: { height: 150 },
  imgBox: { width: '100%', height: '100%' },
  box: { padding: 12 },
  glow: { backgroundColor: '#e0e0e0', borderRadius: 4 },
  on: { opacity: 0.7 },
  off: { opacity: 0.3 },
  title: { height: 20, width: '80%', marginBottom: 8 },
  sub: { height: 16, width: '60%', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  item: { height: 14, width: 60 },
  badges: { flexDirection: 'row', gap: 8 },
  badge: { height: 24, width: 80, borderRadius: 12 }
})

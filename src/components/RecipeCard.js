import React, { useState } from 'react'
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Badge } from './Badge'

export const RecipeCard = ({ recipe, match, isFavorite = false, onPress, onToggleFavorite, showMatchInfo = true }) => {
  const [hovered, setHovered] = useState(false)

  const onHeart = (e) => {
    e.stopPropagation()
    if (onToggleFavorite) onToggleFavorite(recipe.id)
  }

  const getTime = () => {
    if (!recipe.timeMinutes) return 'Time unknown'
    if (recipe.timeMinutes < 60) return `${recipe.timeMinutes}min`
    const h = Math.floor(recipe.timeMinutes / 60)
    const m = recipe.timeMinutes % 60
    return m > 0 ? `${h}h ${m}min` : `${h}h`
  }

  const getDiffColor = () => {
    if (recipe.difficulty === 'easy') return '#28a745'
    if (recipe.difficulty === 'medium') return '#ffc107'
    if (recipe.difficulty === 'hard') return '#dc3545'
    return '#6c757d'
  }

  const hasMatch = showMatchInfo && match
  const canCook = match && match.cookNow
  const hasMissing = match && match.topMissingIngredients?.length > 0

  return (
    <TouchableOpacity style={styles.main} onPress={onPress}>
      <View style={styles.box}>
        <Pressable style={[styles.heart, hovered && styles.heartHover]} onPress={onHeart} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} delayPressIn={0}>
          <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={24} color={isFavorite ? "#007AFF" : "#ccc"} />
        </Pressable>
        <Text style={styles.title} numberOfLines={2}>{recipe.title}</Text>
        <View style={styles.info}>
          <View style={styles.row}><Ionicons name="time-outline" size={14} color="#666" /><Text style={styles.text}>{getTime()}</Text></View>
          {recipe.difficulty && <View style={styles.row}><View style={[styles.dot, { backgroundColor: getDiffColor() }]} /><Text style={styles.text}>{recipe.difficulty}</Text></View>}
        </View>
        {hasMatch && (
          <View style={styles.match}>
            <Text style={styles.score}>{match.matchedCount}/{match.totalIngredients} ingredients</Text>
            <View style={styles.badges}>
              {canCook ? (
                <Badge text="Cook Now!" variant="cookNow" size="small" style={styles.badge} />
              ) : (
                <View style={styles.missing}>
                  <Badge text={`${match.missingCount} missing`} variant="missing" size="small" style={styles.badge} />
                  {hasMissing && (
                    <View style={styles.pills}>
                      {match.topMissingIngredients.map((ing, i) => (
                        <View key={i} style={styles.pill}><Text style={styles.pillText}>{ing.name.length > 8 ? ing.name.substring(0, 8) + '...' : ing.name}</Text></View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  main: { backgroundColor: 'white', borderRadius: 12, marginHorizontal: 16, marginVertical: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, overflow: 'hidden' },
  heart: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2, zIndex: 10 },
  heartHover: { transform: [{ scale: 1.1 }], backgroundColor: 'rgba(255,255,255,1)' },
  badges: { position: 'absolute', top: 6, right: 0, flexDirection: 'column', alignItems: 'flex-end', gap: 4 },
  missing: { flexDirection: 'column', gap: 4, alignItems: 'flex-end' },
  badge: { alignSelf: 'flex-end' },
  pills: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' },
  pill: { backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: '#ffc107' },
  pillText: { fontSize: 10, color: '#856404', fontWeight: '500' },
  box: { padding: 8 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 6, lineHeight: 20 },
  info: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  text: { fontSize: 12, color: '#666' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  match: { position: 'relative', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f0f0f0', minHeight: 40 },
  score: { fontSize: 11, color: '#888' }
})

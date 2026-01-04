import React from 'react'
import { View, ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native'

export const FilterBar = ({ filters, onFilterChange }) => {
  const Btn = ({ label, active, onPress }) => (
    <TouchableOpacity style={[styles.btn, active && styles.on]} onPress={onPress}>
      <Text style={[styles.text, active && styles.onText]}>{label}</Text>
    </TouchableOpacity>
  )

  return (
    <View style={styles.main}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Btn label="All" active={filters.isVegetarian === null} onPress={() => onFilterChange('isVegetarian', null)} />
        <Btn label="Veg" active={filters.isVegetarian === true} onPress={() => onFilterChange('isVegetarian', true)} />
        <Btn label="Non-veg" active={filters.isVegetarian === false} onPress={() => onFilterChange('isVegetarian', false)} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  main: { paddingVertical: 8 },
  scroll: { paddingHorizontal: 16, gap: 8 },
  btn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#e0e0e0' },
  on: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  text: { fontSize: 14, color: '#666', fontWeight: '500' },
  onText: { color: 'white' }
})

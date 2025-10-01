import React from 'react'
import {View,ScrollView,TouchableOpacity,Text,StyleSheet} from 'react-native'

export const FilterBar = ({filters,onFilterChange,onResetFilters,availableOptions = {}})=>{
  const hasFilters = Object.values(filters).some(value=> value!==null)

  const Button = ({label,value,onPress,active = false}) => (
    <TouchableOpacity style={[styles.btn,active && styles.active]} onPress={onPress}>
      <Text style={[styles.text,active && styles.activeText]}>{label}</Text>
    </TouchableOpacity>
  )

  const isAll = filters.isVegetarian=== null
  const isVeg = filters.isVegetarian=== true
  const isNonVeg = filters.isVegetarian=== false

  return (
    <View style={styles.main}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Button label="All" active={isAll} onPress={() => onFilterChange('isVegetarian',null)}/>
        <Button label="Veg" active={isVeg} onPress={() => onFilterChange('isVegetarian',true)}/>
        <Button label="Non-veg" active={isNonVeg} onPress={() => onFilterChange('isVegetarian',false)}/>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  main: {
    paddingVertical: 8
  },
  scroll: {
    paddingHorizontal: 16,
    gap: 8
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  active: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF'
  },
  text: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500'
  },
  activeText: {
    color: 'white'
  }
})

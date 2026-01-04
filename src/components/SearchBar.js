import React, { useState } from 'react'
import { View, TextInput, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

const searchIcon = require('../../assets/icons/search.png')

export const SearchBar = ({ placeholder = "Search...", onSearch, onChangeText, value = "", autoFocus = false }) => {
  const [text, setText] = useState(value)
  const clickSearch = () => {
    const hasSearch = onSearch
    if (hasSearch) {
      onSearch(text.trim())
    }
  }
  const changeText = (newText) => {
    setText(newText)
    const hasChange = onChangeText
    if (hasChange) {
      onChangeText(newText)
    }
  }
  const clickClear = () => {
    setText('')
    const hasChange = onChangeText
    if (hasChange) {
      onChangeText('')
    }
  }
  const hasText = text.length > 0

  return (
    <View style={styles.main}>
      <View style={styles.box}>
        <Image source={searchIcon} style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          value={text}
          onChangeText={changeText}
          onSubmitEditing={clickSearch}
          autoFocus={autoFocus}
          returnKeyType="search"
        />
        {hasText && (
          <TouchableOpacity onPress={clickClear} style={styles.clear}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  main: {
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    paddingHorizontal: 16,
    height: 50
  },
  icon: {
    width: 20,
    height: 20,
    marginRight: 10,
    tintColor: '#666'
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    ...(Platform.OS === 'web' && { outlineStyle: 'none' })
  },
  clear: {
    marginLeft: 10
  }
})

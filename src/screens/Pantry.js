import React, { useState, useCallback } from 'react'
import { View, Text, FlatList, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useStore, addToPantry, removeFromPantry, setPantry, showSnackbar, resetRecipeState, setGeneratedRecipes, setRecipesLoading, setRecipesError } from '../services/store'
import { SearchBar } from '../components/SearchBar'
import { ListItem } from '../components/ListItem'
import { EmptyState } from '../components/EmptyState'
import { IngredientConfirmationDialog } from '../components/IngredientConfirmationDialog'
import { debounce } from '../utils/debounce'
import { detectIngredients } from '../vision/robustDetector'
import { COMMON_INGREDIENTS } from '../constants/ingredients'
import { findRecipes } from '../services/recipes'
import WebCameraCapture from '../components/WebCameraCapture'

export default function Pantry() {
  const nav = useNavigation()
  const { state, dispatch } = useStore()
  const [search, setSearch] = useState('')
  const [hints, setHints] = useState([])
  const [showHints, setShowHints] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [detected, setDetected] = useState([])
  const [showDialog, setShowDialog] = useState(false)
  const [showCamera, setShowCamera] = useState(false)

  const searchItems = useCallback(
    debounce((text) => {
      if (text.trim().length > 0) {
        const matches = COMMON_INGREDIENTS.filter(i =>
          i.toLowerCase().startsWith(text.toLowerCase()) && !state.pantry.items.includes(i)
        ).slice(0, 10)
        setHints(matches)
        setShowHints(true)
      } else {
        setHints([])
        setShowHints(false)
      }
    }, 300),
    [state.pantry.items]
  )

  const onSearchChange = useCallback((text) => {
    setSearch(text)
    searchItems(text)
  }, [searchItems])

  const addItem = useCallback((item) => {
    const clean = item.trim().toLowerCase()
    if (clean && !state.pantry.items.includes(clean)) {
      dispatch(addToPantry(clean))
      setSearch('')
      setHints([])
      setShowHints(false)
    }
  }, [state.pantry.items, dispatch])

  const removeItem = useCallback((item) => dispatch(removeFromPantry(item)), [dispatch])

  const onSearch = useCallback(() => {
    if (search.trim()) addItem(search)
  }, [search, addItem])

  const onScan = useCallback(async () => {
    if (Platform.OS === 'web') {
      setShowCamera(true)
      return
    }

    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Camera permission is required to scan.')
        return
      }

      Alert.alert('Scan Item', 'Choose how to add your photo', [
        {
          text: 'Take Photo',
          onPress: async () => {
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: Platform.OS !== 'android',
              quality: 0.6
            })
            if (!result.canceled && result.assets?.[0]?.uri) await processImg(result.assets[0].uri)
          }
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: Platform.OS !== 'android',
              quality: 0.8
            })
            if (!result.canceled && result.assets?.[0]?.uri) await processImg(result.assets[0].uri)
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ])
    } catch (err) {
      Alert.alert('Error', 'Failed to access camera.')
    }
  }, [])

  const onWebCapture = useCallback(async (url) => {
    setShowCamera(false)
    await processImg(url)
  }, [])

  const processImg = useCallback(async (uri) => {
    setScanning(true)
    try {
      const items = await detectIngredients(uri)
      const names = items.map(d => d.name)

      if (names.length === 0) {
        const msg = "We couldn't detect any ingredients. Try a clearer photo."
        Platform.OS === 'web' ? alert(msg) : Alert.alert('No Ingredients Found', msg)
        return
      }

      setDetected(names)
      setShowDialog(true)
    } catch (err) {
      let msg = 'Failed to scan. Please try again.'
      if (err.message?.includes('Azure Vision')) msg = 'Azure Vision not configured.'
      else if (err.message?.includes('network') || err.message?.includes('fetch')) msg = 'Network error.'
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg)
    } finally {
      setScanning(false)
    }
  }, [])

  const onConfirm = useCallback((items) => {
    let count = 0
    items.forEach(i => {
      if (!state.pantry.items.includes(i)) {
        dispatch(addToPantry(i))
        count++
      }
    })
    setShowDialog(false)
    setDetected([])
    dispatch(showSnackbar(`Added ${count} ingredient${count !== 1 ? 's' : ''}!`, 'VIEW RECIPES', () => nav.navigate('Matches')))
  }, [state.pantry.items, dispatch, nav])

  const onCancel = useCallback(() => {
    setShowDialog(false)
    setDetected([])
  }, [])

  const onClear = useCallback(() => {
    if (Platform.OS === 'web') {
      if (window.confirm('Clear all ingredients?')) dispatch(setPantry([]))
      return
    }
    Alert.alert('Clear Pantry', 'Remove all ingredients?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => dispatch(setPantry([])) }
    ])
  }, [dispatch])

  const onFindRecipes = useCallback(async () => {
    if (state.pantry.items.length === 0) {
      Platform.OS === 'web' ? alert('Add ingredients first!') : Alert.alert('No Ingredients', 'Add ingredients first!')
      return
    }

    try {
      dispatch(resetRecipeState())
      dispatch(setRecipesLoading(true))
      const result = await findRecipes(state.pantry.items, state.filters, { limit: 3 })
      const recipes = result.recipes || []
      dispatch(setGeneratedRecipes(recipes))
      dispatch(setRecipesLoading(false))

      if (recipes.length > 0) nav.navigate('Matches')
      else Platform.OS === 'web' ? alert('No recipes found.') : Alert.alert('No Recipes', 'Try adding more ingredients.')
    } catch (err) {
      console.error('Recipe error:', err)
      dispatch(setRecipesError(err.message || 'Failed'))
      dispatch(setRecipesLoading(false))
      Alert.alert('Error', 'Failed to find recipes.')
    }
  }, [state.pantry.items, state.filters, dispatch, nav])

  const renderItem = ({ item }) => (
    <ListItem title={item} rightIcon={<Ionicons name="close" size={20} color="#FF3B30" />} onRightIconPress={() => removeItem(item)} />
  )

  const renderHint = ({ item }) => (
    <ListItem title={item} leftIcon={<Ionicons name="add-circle-outline" size={20} color="#007AFF" />} onPress={() => addItem(item)} style={styles.hint} />
  )

  const Header = () => (
    <View style={styles.header}>
      <Text style={styles.title}>My Pantry</Text>
      <Text style={styles.count}>{state.pantry.items.length} ingredients</Text>
      <SearchBar placeholder="Add ingredients..." value={search} onChangeText={onSearchChange} onSearch={onSearch} autoFocus={false} />
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, scanning && styles.off]} onPress={onScan} disabled={scanning}>
          {scanning ? (
            <><ActivityIndicator size="small" color="#007AFF" /><Text style={styles.btnText}>Scanning...</Text></>
          ) : (
            <><Ionicons name="camera" size={20} color="#007AFF" /><Text style={styles.btnText}>Scan Item</Text></>
          )}
        </TouchableOpacity>
        {state.pantry.items.length > 0 && (
          <TouchableOpacity style={[styles.btn, styles.clearBtn]} onPress={onClear}>
            <Ionicons name="trash-outline" size={20} color="#dc3545" />
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )

  const Content = () => {
    if (showHints && hints.length > 0) {
      return (
        <View style={styles.hints}>
          <Text style={styles.hintsTitle}>Suggestions</Text>
          <FlatList data={hints} renderItem={renderHint} keyExtractor={i => i} style={styles.hintList} />
        </View>
      )
    }
    if (state.pantry.items.length === 0) {
      return <EmptyState icon="basket-outline" title="Your pantry is empty" description="Add ingredients to find recipes" actionText="Add Ingredient" onActionPress={() => Alert.alert('Tip', 'Use search or Scan above!')} />
    }
    return (
      <FlatList
        data={state.pantry.items}
        renderItem={renderItem}
        keyExtractor={i => i}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListFooterComponent={state.pantry.items.length > 0 ? (
          <TouchableOpacity style={[styles.findBtn, state.recipesLoading && styles.findOff]} onPress={onFindRecipes} disabled={state.recipesLoading}>
            {state.recipesLoading ? (
              <><ActivityIndicator size="small" color="#fff" /><Text style={styles.findText}>Finding...</Text></>
            ) : (
              <Text style={styles.findText}>Find Recipes</Text>
            )}
          </TouchableOpacity>
        ) : null}
      />
    )
  }

  return (
    <SafeAreaView style={styles.main}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      <Header />
      <Content />
      <IngredientConfirmationDialog visible={showDialog} ingredients={detected} onConfirm={onConfirm} onCancel={onCancel} />
      <WebCameraCapture visible={showCamera} onCapture={onWebCapture} onClose={() => setShowCamera(false)} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: '#f8f9fa', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { backgroundColor: 'white', paddingTop: 16, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333', paddingHorizontal: 16, marginBottom: 4 },
  count: { fontSize: 16, color: '#666', paddingHorizontal: 16, marginBottom: 16 },
  actions: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  btn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#f0f0f0', gap: 6 },
  off: { backgroundColor: '#f8f8f8' },
  btnText: { fontSize: 14, fontWeight: '500', color: '#007AFF' },
  clearBtn: { backgroundColor: '#fff5f5' },
  clearText: { fontSize: 14, fontWeight: '500', color: '#dc3545' },
  findBtn: { backgroundColor: '#007AFF', borderRadius: 24, paddingHorizontal: 32, paddingVertical: 14, marginHorizontal: 16, marginTop: 20, marginBottom: 20, alignItems: 'center', alignSelf: 'center', minWidth: 160, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  findOff: { opacity: 0.7 },
  findText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  hints: { flex: 1, backgroundColor: 'white' },
  hintsTitle: { fontSize: 16, fontWeight: '600', color: '#333', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#f8f9fa' },
  hintList: { flex: 1 },
  hint: { backgroundColor: '#fafafa' },
  list: { paddingBottom: 20 }
})

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

export default function Pantry() {
  const navigation = useNavigation()
  const { state, dispatch } = useStore()
  const [searchText, setSearchText] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [detectedIngredients, setDetectedIngredients] = useState([])
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const debouncedSearch = useCallback(
    debounce((text) => {
      if (text.trim().length > 0) {
        const filtered = COMMON_INGREDIENTS.filter((ingredient) =>
          ingredient.toLowerCase().startsWith(text.toLowerCase()) &&
          !state.pantry.items.includes(ingredient)
        ).slice(0, 10)
        setSuggestions(filtered)
        setShowSuggestions(true)
      } else {
        setSuggestions([])
        setShowSuggestions(false)
      }
    }, 300),
    [state.pantry.items]
  )

  const handleSearchChange = useCallback((text) => {
    setSearchText(text)
    debouncedSearch(text)
  }, [debouncedSearch])

  const addPantryItem = useCallback((ingredient) => {
    const cleanItem = ingredient.trim().toLowerCase()
    if (cleanItem && !state.pantry.items.includes(cleanItem)) {
      dispatch(addToPantry(cleanItem))
      setSearchText('')
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [state.pantry.items, dispatch])

  const removePantryItem = useCallback((ingredient) => {
    dispatch(removeFromPantry(ingredient))
  }, [dispatch])

  const handleSearchPress = useCallback(() => {
    if (searchText.trim()) {
      addPantryItem(searchText)
    }
  }, [searchText, addPantryItem])

  const handleScanPress = useCallback(async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync()

      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          'Camera permission is required to scan your fridge. Please enable it in your device settings.',
          [{ text: 'OK' }]
        )
        return
      }

      Alert.alert(
        'Scan Item',
        'Choose how to add your photo',
        [
          {
            text: 'Take Photo',
            onPress: async () => {
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.8,
              })

              if (!result.canceled && result.assets?.[0]?.uri) {
                await processImage(result.assets[0].uri)
              }
            },
          },
          {
            text: 'Choose from Gallery',
            onPress: async () => {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.8,
              })

              if (!result.canceled && result.assets?.[0]?.uri) {
                await processImage(result.assets[0].uri)
              }
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      )
    } catch (error) {
      Alert.alert('Error', 'Failed to access camera. Please try again.')
    }
  }, [])

  const processImage = useCallback(async (imageUri) => {
    setScanning(true)
    try {
      const detected = await detectIngredients(imageUri)
      const ingredients = detected.map(d => d.name)

      if (ingredients.length === 0) {
        Alert.alert(
          'No Ingredients Found',
          'We couldn\'t detect any ingredients in the image. Try taking a clearer photo or add items manually.',
          [{ text: 'OK' }]
        )
        return
      }

      setDetectedIngredients(ingredients)
      setShowConfirmDialog(true)

    } catch (error) {
      let errorMessage = 'Failed to scan image. Please try again.'

      if (error.message?.includes('Azure Vision API key not configured')) {
        errorMessage = 'Azure Vision is not configured. Please check your API credentials.'
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = 'Network error. Please check your internet connection and try again.'
      }

      Alert.alert('Scanning Error', errorMessage, [{ text: 'OK' }])
    } finally {
      setScanning(false)
    }
  }, [])

  const onIngredientsConfirmed = useCallback((confirmedItems) => {
    let addedCount = 0
    confirmedItems.forEach(item => {
      if (!state.pantry.items.includes(item)) {
        dispatch(addToPantry(item))
        addedCount++
      }
    })

    setShowConfirmDialog(false)
    setDetectedIngredients([])

    dispatch(showSnackbar(
      `Added ${addedCount} new ingredient${addedCount !== 1 ? 's' : ''} to your pantry!`,
      'VIEW RECIPES',
      () => navigation.navigate('Matches')
    ))
  }, [state.pantry.items, dispatch, navigation])

  const onConfirmationCancelled = useCallback(() => {
    setShowConfirmDialog(false)
    setDetectedIngredients([])
  }, [])

  const handleClearPress = useCallback(() => {
    Alert.alert(
      'Clear Pantry',
      'Are you sure you want to remove all ingredients from your pantry?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => dispatch(setPantry([])), },
      ]
    )
  }, [dispatch])

  const handleFindRecipes = useCallback(async () => {
    if (state.pantry.items.length === 0) {
      Alert.alert('No Ingredients', 'Add some ingredients to your pantry first!')
      return
    }

    try {
      dispatch(resetRecipeState())
      dispatch(setRecipesLoading(true))

      const result = await findRecipes(state.pantry.items, state.filters, { limit: 3 })
      const recipes = result.recipes || []

      dispatch(setGeneratedRecipes(recipes))
      dispatch(setRecipesLoading(false))

      if (recipes.length > 0) {
        navigation.navigate('Matches')
      } else {
        Alert.alert('No Recipes Found', 'Try adjusting your filters or adding more ingredients.')
      }
    } catch (error) {
      console.error('Error finding recipes:', error)
      dispatch(setRecipesError(error.message || 'Failed to find recipes'))
      dispatch(setRecipesLoading(false))
      Alert.alert('Error', 'Failed to find recipes. Please try again.')
    }
  }, [state.pantry.items, state.filters, dispatch, navigation])

  const renderPantryItem = ({ item }) => (
    <ListItem
      title={item}
      rightIcon={
        <Ionicons name="close" size={20} color="#FF3B30" />
      }
      onRightIconPress={() => removePantryItem(item)} />
  )

  const renderSuggestion = ({ item }) => (
    <ListItem
      title={item}
      leftIcon={
        <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
      }
      onPress={() => addPantryItem(item)}
      style={styles.suggestionItem}
    />
  )

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.title}>My Pantry</Text>
      <Text style={styles.subtitle}>
        {state.pantry.items.length} ingredients
      </Text>
      <SearchBar
        placeholder="Add ingredients..."
        value={searchText}
        onChangeText={handleSearchChange}
        onSearch={handleSearchPress}
        autoFocus={false} />
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, scanning && styles.disabled]}
          onPress={handleScanPress}
          disabled={scanning}>
          {scanning ? (
            <>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={[styles.actionText, { color: '#007AFF' }]}>Scanning...</Text>
            </>
          ) : (
            <>
              <Ionicons name="camera" size={20} color="#007AFF" />
              <Text style={[styles.actionText, { color: '#007AFF' }]}>Scan Item</Text>
            </>
          )}
        </TouchableOpacity>
        {state.pantry.items.length > 0 && (
          <TouchableOpacity
            style={[styles.actionButton, styles.clear]}
            onPress={handleClearPress}>
            <Ionicons name="trash-outline" size={20} color="#dc3545" />
            <Text style={[styles.actionText, styles.clearText]}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )

  const renderContent = () => {
    if (showSuggestions && suggestions.length > 0) {
      return (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Suggestions</Text>
          <FlatList
            data={suggestions}
            renderItem={renderSuggestion}
            keyExtractor={(item) => item}
            style={styles.suggestionsList} />
        </View>
      )
    }
    if (state.pantry.items.length === 0) {
      return (
        <EmptyState
          icon="basket-outline"
          title="Your pantry is empty"
          description="Add ingredients you have at home to find matching recipes"
          actionText="Add Your First Ingredient"
          onActionPress={() => {
            Alert.alert('Add Ingredients', 'Use the search bar or Scan above to add ingredients to your pantry!')
          }}
        />
      )
    }

    return (
      <FlatList
        data={state.pantry.items}
        renderItem={renderPantryItem}
        keyExtractor={(item) => item}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListFooterComponent={
          state.pantry.items.length > 0 ? (
            <TouchableOpacity
              style={[styles.findButton, state.recipesLoading && styles.findButtonLoading]}
              onPress={handleFindRecipes}
              disabled={state.recipesLoading}>
              {state.recipesLoading ? (
                <>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.findText}>Finding Recipes...</Text>
                </>
              ) : (
                <Text style={styles.findText}>Find Recipes</Text>
              )}
            </TouchableOpacity>
          ) : null
        }
      />
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      {renderHeader()}
      {renderContent()}

      <IngredientConfirmationDialog
        visible={showConfirmDialog}
        ingredients={detectedIngredients}
        onConfirm={onIngredientsConfirmed}
        onCancel={onConfirmationCancelled}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  headerContainer: {
    backgroundColor: 'white',
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    gap: 6,
  },
  disabled: {
    backgroundColor: '#f8f8f8',
  },
  clear: {
    backgroundColor: '#fff5f5',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  disabledText: {
    color: '#999',
  },
  clearText: {
    color: '#dc3545',
  },
  findButton: {
    backgroundColor: '#007AFF',
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 20,
    alignItems: 'center',
    alignSelf: 'center',
    minWidth: 160,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  findButtonLoading: {
    opacity: 0.7,
  },
  findText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  suggestionsContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
  },
  suggestionsList: {
    flex: 1,
  },
  suggestionItem: {
    backgroundColor: '#fafafa',
  },
  list: {
    paddingBottom: 20,
  },
})

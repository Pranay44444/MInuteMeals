import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, StyleSheet, SafeAreaView, StatusBar, RefreshControl, Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useStore, setCurrentRecipe, removeFromFavorites, addToFavorites } from '../services/store'
import { RecipeCard } from '../components/RecipeCard'
import { EmptyState } from '../components/EmptyState'
import { getRecipe, checkRecipeMatch, makePantrySet } from '../services/recipes'

export default function Favorites() {
  const navigation = useNavigation()
  const { state, dispatch } = useStore()
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const loadRecipes = useCallback(async () => {
    const hasFavorites = state.favorites.length > 0
    if (!hasFavorites) {
      setRecipes([])
      return
    }
    setLoading(true)
    try {
      const pantrySet = makePantrySet(state.pantry.items)
      const recipePromises = state.favorites.map(async (recipeId) => {
        try {
          const recipe = await getRecipe(recipeId)
          if (recipe) {
            const match = checkRecipeMatch(recipe, pantrySet)
            return { recipe, match }
          }
          return null
        } catch (error) {
          return null
        }
      })
      const results = await Promise.all(recipePromises)
      const validRecipes = results.filter((result) => result !== null)
      setRecipes(validRecipes)
    } catch (error) {
      Alert.alert('Error', 'Failed to load favorite recipes. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [state.favorites, state.pantry.items])

  useEffect(() => {
    loadRecipes()
  }, [loadRecipes])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadRecipes()
    setRefreshing(false)
  }, [loadRecipes])

  const handleRecipePress = useCallback((item) => {
    dispatch(setCurrentRecipe({
      recipe: item.recipe,
      match: item.match
    }))
    navigation.navigate('RecipeDetail', { id: item.recipe.id })
  }, [dispatch, navigation])

  const toggleFavorite = useCallback((recipeId) => {
    const isFavorite = state.favorites.includes(recipeId)
    if (isFavorite) {
      dispatch(removeFromFavorites(recipeId))
    } else {
      dispatch(addToFavorites(recipeId))
    }
  }, [state.favorites, dispatch])

  const renderRecipeCard = ({ item }) => (
    <RecipeCard
      recipe={item.recipe}
      match={item.match}
      isFavorite={state.favorites.includes(item.recipe.id)}
      onPress={() => handleRecipePress(item)}
      onToggleFavorite={toggleFavorite}
      showMatchInfo={true} />
  )

  const renderHeader = () => {
    const count = state.favorites.length
    const hasNone = count === 0
    return (
      <View style={styles.headerContainer}>
        <Text style={styles.title}>My Favorites</Text>
        <Text style={styles.subtitle}>
          {hasNone ? 'No favorites yet' : `${count} favorite recipes`}
        </Text>
      </View>
    )
  }

  const renderEmptyState = () => (
    <EmptyState
      icon="heart-outline"
      title="No favorite recipes yet"
      description="Tap the heart icon on recipes you love to save them here"
      actionText="Discover Recipes"
      onActionPress={() => navigation.navigate('Matches')}
    />
  )
  const hasRecipes = recipes.length > 0

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      {hasRecipes ? (
        <FlatList
          data={recipes}
          renderItem={renderRecipeCard}
          keyExtractor={(item) => item.recipe.id}
          ListHeaderComponent={renderHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#007AFF" />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.recipeList}
        />
      ) : (
        <View style={styles.container}>
          {renderHeader()}
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading favorites...</Text>
            </View>
          ) : (
            renderEmptyState()
          )}
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  },
  headerContainer: {
    backgroundColor: 'white',
    paddingTop: 16,
    paddingBottom: 16
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 16,
    marginBottom: 4
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    paddingHorizontal: 16
  },
  recipeList: {
    paddingBottom: 20
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    fontSize: 16,
    color: '#666'
  }
})

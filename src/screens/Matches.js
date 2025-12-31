import React, { useEffect, useState, useCallback, useRef } from 'react'
import { View, Text, FlatList, StyleSheet, RefreshControl, Alert, SafeAreaView, StatusBar, TouchableOpacity, ActivityIndicator, Platform } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { useStore, setCurrentRecipe, setRecipes, setLoading, setError, setFilter, resetFilters, addToFavorites, removeFromFavorites, appendGeneratedRecipes, setRecipesLoading, setRecipesError, setHasMoreRecipes } from '../services/store'
import { FilterBar } from '../components/FilterBar'
import { RecipeCard } from '../components/RecipeCard'
import { RecipeSkeleton } from '../components/RecipeSkeleton'
import { EmptyState } from '../components/EmptyState'
import { findRecipes, normalizeIngredient, processRecipes, getFilters } from '../services/recipes'
import { convertIngredientsToIndianUnits } from '../utils/unitConverter'

export default function Matches() {
  const navigation = useNavigation()
  const { state, dispatch } = useStore()
  const [recipesWithMatches, setRecipesWithMatches] = useState([])
  const [filterOptions, setFilterOptions] = useState({})

  // Update local state when generated recipes change or filters change
  useEffect(() => {
    if (state.generatedRecipes.length > 0) {
      // Convert all recipes to Indian units
      const convertedRecipes = state.generatedRecipes.map(recipe => ({
        ...recipe,
        ingredients: convertIngredientsToIndianUnits(recipe.ingredients || [])
      }))

      // Apply veg/non-veg filter locally
      let filteredRecipes = convertedRecipes

      if (state.filters.isVegetarian !== null) {
        filteredRecipes = filteredRecipes.filter(recipe =>
          recipe.isVegetarian === state.filters.isVegetarian
        )
      }

      const recipesWithMatchData = processRecipes(filteredRecipes, state.pantry.items)
      setRecipesWithMatches(recipesWithMatchData)
      setFilterOptions(getFilters(convertedRecipes))
    } else {
      setRecipesWithMatches([])
      setFilterOptions({})
    }
  }, [state.generatedRecipes, state.pantry.items, state.filters.isVegetarian, dispatch])

  const handleLoadMore = useCallback(async () => {
    if (state.recipesLoading || !state.hasMoreRecipes) return

    try {
      dispatch(setRecipesLoading(true))

      const result = await findRecipes(state.pantry.items, state.filters, { limit: 3 })
      const newRecipes = result.recipes || []

      if (newRecipes.length > 0) {
        // Filter out duplicates by comparing recipe titles (case-insensitive)
        const existingTitles = new Set(
          state.generatedRecipes.map(r => r.title.toLowerCase())
        )
        const uniqueNewRecipes = newRecipes.filter(
          recipe => !existingTitles.has(recipe.title.toLowerCase())
        )

        if (uniqueNewRecipes.length > 0) {
          dispatch(appendGeneratedRecipes(uniqueNewRecipes))
        } else {
          // All recipes were duplicates, no more unique recipes available
          dispatch(setHasMoreRecipes(false))
        }
      } else {
        // No more recipes available
        dispatch(setHasMoreRecipes(false))
      }

      dispatch(setRecipesLoading(false))
    } catch (error) {
      console.error('Error loading more recipes:', error)
      dispatch(setRecipesError(error.message || 'Failed to load more recipes'))
      dispatch(setRecipesLoading(false))
      Alert.alert('Error', 'Failed to load more recipes. Please try again.')
    }
  }, [state.pantry.items, state.filters, state.recipesLoading, state.hasMoreRecipes, state.generatedRecipes, dispatch])





  const clickRecipe = useCallback((item) => {
    dispatch(setCurrentRecipe({
      recipe: item.recipe,
      match: item.match,
    }))
    navigation.navigate('RecipeDetail', { id: item.recipe.id })
  }, [dispatch])

  const clickHeart = useCallback((recipe) => {
    const isFavorite = state.favorites.some(r => r.id === recipe.id)
    if (isFavorite) {
      dispatch(removeFromFavorites(recipe.id))
    } else {
      dispatch(addToFavorites(recipe))
    }
  }, [state.favorites, dispatch])

  const changeFilter = useCallback((filterType, value) => {
    dispatch(setFilter(filterType, value))
  }, [dispatch])

  const clearFilters = useCallback(() => {
    dispatch(resetFilters())
  }, [dispatch])

  const showSkeletons = () => {
    return Array.from({ length: 6 }, (_, index) => (
      <RecipeSkeleton key={`skeleton-${index}`} />
    ))
  }

  const showSectionHeader = (title, count) => (
    <View style={styles.section}>
      <Text style={styles.secTitle}>{title}</Text>
      <Text style={styles.secCount}>({count})</Text>
    </View>
  )

  const showEmptyPantry = () => (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyTitle}>No ingredients added</Text>
      <Text style={styles.emptySub}>
        Add ingredients from pantry to get recipe suggestions
      </Text>
      <TouchableOpacity
        style={styles.goButton}
        onPress={() => navigation.navigate('Pantry')}>
        <Text style={styles.goText}>Go to Pantry</Text>
      </TouchableOpacity>
    </View>
  )

  const showEmpty = () => {
    if (state.pantry.items.length === 0) {
      return showEmptyPantry()
    }

    // If pantry has items but no recipes, prompt to find recipes
    if (state.generatedRecipes.length === 0) {
      return (
        <EmptyState
          icon="search-outline"
          title="No recipes loaded"
          subtitle="Click 'Find Recipes' from the Pantry to discover matching recipes."
          actionText="Go to Pantry"
          onActionPress={() => navigation.navigate('Pantry')}
        />
      )
    }

    return (
      <EmptyState
        title="No recipes found"
        subtitle="Try adjusting your filters or adding more ingredients to your pantry."
        actionText="Reset Filters"
        onActionPress={clearFilters}
      />
    )
  }

  const showCard = ({ item }) => {
    if (item.type === 'section-header') {
      return showSectionHeader(item.title, item.count)
    }
    return (
      <RecipeCard
        recipe={item.recipe}
        match={item.match}
        isFavorite={state.favorites.some(r => r.id === item.recipe.id)}
        onPress={() => clickRecipe(item)}
        onToggleFavorite={() => clickHeart(item.recipe)}
      />
    )
  }

  const prepareData = () => {
    if (recipesWithMatches.length === 0) {
      return []
    }
    const data = []
    if (state.pantry.items.length === 0) {
      return data
    } else {
      const cookNowRecipes = recipesWithMatches
        .filter(item => item.match.missingCount === 0 && item.match.totalIngredients > 3)
        .sort((a, b) => b.match.matchedCount - a.match.matchedCount)
      const almostThereRecipes = recipesWithMatches
        .filter(item =>
          item.match.missingCount > 0 &&
          item.match.missingCount <= 15 &&
          item.match.matchedCount > 0
        )
        .sort((a, b) => {
          if (b.match.matchedCount !== a.match.matchedCount) {
            return b.match.matchedCount - a.match.matchedCount
          }
          return a.match.missingCount - b.match.missingCount
        })
      if (cookNowRecipes.length > 0) {
        data.push({
          key: 'cook-now-header',
          type: 'section-header',
          title: 'Cook Now',
          count: cookNowRecipes.length,
        })
        cookNowRecipes.forEach((item, index) => {
          data.push({ ...item, key: `cook-now-${index}` })
        })
      }
      if (almostThereRecipes.length > 0) {
        data.push({
          key: 'almost-there-header',
          type: 'section-header',
          title: 'Almost There',
          count: almostThereRecipes.length,
        })
        almostThereRecipes.forEach((item, index) => {
          data.push({ ...item, key: `almost-there-${index}` })
        })
      }
    }
    return data
  }
  const flatListData = prepareData()

  return (
    <SafeAreaView style={styles.main}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.top}>
        <Text style={styles.title}>Recipe Matches</Text>
        <Text style={styles.sub}>
          Based on {state.pantry.items.length} ingredient{state.pantry.items.length === 1 ? '' : 's'} in your pantry
        </Text>
        <FilterBar
          filters={state.filters}
          options={filterOptions}
          onFilterChange={changeFilter}
          onResetFilters={clearFilters}
        />
      </View>
      {flatListData.length === 0 ? (
        showEmpty()
      ) : (
        <FlatList
          data={flatListData}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => {
            if (item.type === 'skeleton') {
              return item.component
            }
            return showCard({ item })
          }}
          ListFooterComponent={
            state.hasMoreRecipes && flatListData.length > 0 ? (
              <TouchableOpacity
                style={[styles.loadMoreBtn, state.recipesLoading && styles.loadMoreBtnLoading]}
                onPress={handleLoadMore}
                disabled={state.recipesLoading}>
                {state.recipesLoading ? (
                  <>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <Text style={styles.loadMoreText}>Loading...</Text>
                  </>
                ) : (
                  <Text style={styles.loadMoreText}>Load More Recipes</Text>
                )}
              </TouchableOpacity>
            ) : null
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  top: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 4,
  },
  sub: {
    fontSize: 16,
    fontWeight: '400',
    color: '#6c757d',
    marginBottom: 16,
  },
  list: {
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  skeletons: {
    padding: 16,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
    marginHorizontal: 4,
  },
  secTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212529',
  },
  secCount: {
    fontSize: 16,
    color: '#6c757d',
    marginLeft: 8,
  },
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#343a40',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  goButton: {
    backgroundColor: '#007AFF',
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
    minWidth: 160,
  },
  goText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
    gap: 8,
  },
  loadMoreBtnLoading: {
    opacity: 0.6,
  },
  loadMoreText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '600',
  },
})
import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, StyleSheet, Alert, SafeAreaView, StatusBar, TouchableOpacity, ActivityIndicator, Platform } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useStore, setCurrentRecipe, setFilter, resetFilters, addToFavorites, removeFromFavorites, appendGeneratedRecipes, setRecipesLoading, setRecipesError, setHasMoreRecipes } from '../services/store'
import { FilterBar } from '../components/FilterBar'
import { RecipeCard } from '../components/RecipeCard'
import { RecipeSkeleton } from '../components/RecipeSkeleton'
import { EmptyState } from '../components/EmptyState'
import { findRecipes, processRecipes, getFilters } from '../services/recipes'
import { convertIngredientsToIndianUnits } from '../utils/unitConverter'

export default function Matches() {
  const nav = useNavigation()
  const { state, dispatch } = useStore()
  const [recipes, setRecipes] = useState([])
  const [options, setOptions] = useState({})

  useEffect(() => {
    if (state.generatedRecipes.length > 0) {
      const converted = state.generatedRecipes.map(r => ({
        ...r,
        ingredients: convertIngredientsToIndianUnits(r.ingredients || [])
      }))

      let filtered = converted
      if (state.filters.isVegetarian !== null) {
        filtered = filtered.filter(r => r.isVegetarian === state.filters.isVegetarian)
      }

      const data = processRecipes(filtered, state.pantry.items)
      setRecipes(data)
      setOptions(getFilters(converted))
    } else {
      setRecipes([])
      setOptions({})
    }
  }, [state.generatedRecipes, state.pantry.items, state.filters.isVegetarian])

  const loadMore = useCallback(async () => {
    if (state.recipesLoading || !state.hasMoreRecipes) return

    try {
      dispatch(setRecipesLoading(true))
      const result = await findRecipes(state.pantry.items, state.filters, { limit: 3 })
      const newRecipes = result.recipes || []

      if (newRecipes.length > 0) {
        const existing = new Set(state.generatedRecipes.map(r => r.title.toLowerCase()))
        const unique = newRecipes.filter(r => !existing.has(r.title.toLowerCase()))

        if (unique.length > 0) dispatch(appendGeneratedRecipes(unique))
        else dispatch(setHasMoreRecipes(false))
      } else {
        dispatch(setHasMoreRecipes(false))
      }
      dispatch(setRecipesLoading(false))
    } catch (err) {
      console.error('Load error:', err)
      dispatch(setRecipesError(err.message || 'Failed'))
      dispatch(setRecipesLoading(false))
      Alert.alert('Error', 'Failed to load more recipes.')
    }
  }, [state.pantry.items, state.filters, state.recipesLoading, state.hasMoreRecipes, state.generatedRecipes, dispatch])

  const openRecipe = useCallback((item) => {
    dispatch(setCurrentRecipe({ recipe: item.recipe, match: item.match }))
    nav.navigate('RecipeDetail', { id: item.recipe.id })
  }, [dispatch, nav])

  const toggleFav = useCallback((recipe) => {
    const isFav = state.favorites.some(r => r.id === recipe.id)
    isFav ? dispatch(removeFromFavorites(recipe.id)) : dispatch(addToFavorites(recipe))
  }, [state.favorites, dispatch])

  const onFilter = useCallback((type, val) => dispatch(setFilter(type, val)), [dispatch])
  const onReset = useCallback(() => dispatch(resetFilters()), [dispatch])

  const Section = (title, count) => (
    <View style={styles.section}>
      <Text style={styles.secTitle}>{title}</Text>
      <Text style={styles.secCount}>({count})</Text>
    </View>
  )

  const Empty = () => {
    if (state.pantry.items.length === 0) {
      return (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No ingredients added</Text>
          <Text style={styles.emptySub}>Add ingredients from pantry to get recipes</Text>
          <TouchableOpacity style={styles.goBtn} onPress={() => nav.navigate('Pantry')}>
            <Text style={styles.goText}>Go to Pantry</Text>
          </TouchableOpacity>
        </View>
      )
    }
    if (state.generatedRecipes.length === 0) {
      return <EmptyState icon="search-outline" title="No recipes loaded" subtitle="Click 'Find Recipes' from Pantry" actionText="Go to Pantry" onActionPress={() => nav.navigate('Pantry')} />
    }
    return <EmptyState title="No recipes found" subtitle="Try adjusting filters" actionText="Reset Filters" onActionPress={onReset} />
  }

  const Card = ({ item }) => {
    if (item.type === 'header') return Section(item.title, item.count)
    return <RecipeCard recipe={item.recipe} match={item.match} isFavorite={state.favorites.some(r => r.id === item.recipe.id)} onPress={() => openRecipe(item)} onToggleFavorite={() => toggleFav(item.recipe)} />
  }

  const getData = () => {
    if (recipes.length === 0 || state.pantry.items.length === 0) return []

    const data = []
    const ready = recipes.filter(i => i.match.missingCount === 0 && i.match.totalIngredients > 3).sort((a, b) => b.match.matchedCount - a.match.matchedCount)
    const almost = recipes.filter(i => i.match.missingCount > 0 && i.match.missingCount <= 15 && i.match.matchedCount > 0).sort((a, b) => b.match.matchedCount !== a.match.matchedCount ? b.match.matchedCount - a.match.matchedCount : a.match.missingCount - b.match.missingCount)

    if (ready.length > 0) {
      data.push({ key: 'h1', type: 'header', title: 'Cook Now', count: ready.length })
      ready.forEach((item, i) => data.push({ ...item, key: `r${i}` }))
    }
    if (almost.length > 0) {
      data.push({ key: 'h2', type: 'header', title: 'Almost There', count: almost.length })
      almost.forEach((item, i) => data.push({ ...item, key: `a${i}` }))
    }
    return data
  }

  const listData = getData()

  return (
    <SafeAreaView style={styles.main}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.top}>
        <Text style={styles.title}>Recipe Matches</Text>
        <Text style={styles.sub}>Based on {state.pantry.items.length} ingredient{state.pantry.items.length === 1 ? '' : 's'}</Text>
        <FilterBar filters={state.filters} options={options} onFilterChange={onFilter} onResetFilters={onReset} />
      </View>
      {listData.length === 0 ? <Empty /> : (
        <FlatList
          data={listData}
          keyExtractor={i => i.key}
          renderItem={Card}
          ListFooterComponent={state.hasMoreRecipes && listData.length > 0 ? (
            <TouchableOpacity style={[styles.loadBtn, state.recipesLoading && styles.loadOff]} onPress={loadMore} disabled={state.recipesLoading}>
              {state.recipesLoading ? (
                <><ActivityIndicator size="small" color="#007AFF" /><Text style={styles.loadText}>Loading...</Text></>
              ) : (
                <Text style={styles.loadText}>Load More Recipes</Text>
              )}
            </TouchableOpacity>
          ) : null}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: '#f8f9fa', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  top: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e9ecef' },
  title: { fontSize: 24, fontWeight: '700', color: '#212529', marginBottom: 4 },
  sub: { fontSize: 16, color: '#6c757d', marginBottom: 16 },
  list: { paddingVertical: 8 },
  section: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 8, marginHorizontal: 4 },
  secTitle: { fontSize: 20, fontWeight: '700', color: '#212529' },
  secCount: { fontSize: 16, color: '#6c757d', marginLeft: 8 },
  emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#343a40', marginBottom: 12, textAlign: 'center' },
  emptySub: { fontSize: 16, color: '#6c757d', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  goBtn: { backgroundColor: '#007AFF', borderRadius: 24, paddingHorizontal: 32, paddingVertical: 14, minWidth: 160 },
  goText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  loadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0', borderRadius: 24, paddingHorizontal: 24, paddingVertical: 12, marginHorizontal: 16, marginTop: 16, marginBottom: 20, gap: 8 },
  loadOff: { opacity: 0.6 },
  loadText: { color: '#007AFF', fontSize: 15, fontWeight: '600' }
})
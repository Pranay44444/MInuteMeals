import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, StyleSheet, SafeAreaView, StatusBar, RefreshControl, Alert, Platform } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useStore, setCurrentRecipe, removeFromFavorites, addToFavorites } from '../services/store'
import { RecipeCard } from '../components/RecipeCard'
import { EmptyState } from '../components/EmptyState'
import { checkRecipeMatch, makePantrySet } from '../services/recipes'
import { LoadingDots } from '../components/LoadingDots'

export default function Favorites() {
  const nav = useNavigation()
  const { state, dispatch } = useStore()
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async () => {
    if (state.favorites.length === 0) { setRecipes([]); return }
    setLoading(true)
    try {
      const pantrySet = makePantrySet(state.pantry.items)
      const data = state.favorites.map(recipe => {
        if (typeof recipe === 'string') return null
        const match = checkRecipeMatch(recipe, pantrySet)
        return { recipe, match }
      }).filter(i => i !== null)
      setRecipes(data)
    } catch (err) {
      Alert.alert('Error', 'Failed to load favorites.')
    } finally {
      setLoading(false)
    }
  }, [state.favorites, state.pantry.items])

  useEffect(() => { loadData() }, [loadData])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }, [loadData])

  const openRecipe = useCallback((item) => {
    dispatch(setCurrentRecipe({ recipe: item.recipe, match: item.match }))
    nav.navigate('RecipeDetail', { id: item.recipe.id })
  }, [dispatch, nav])

  const toggleFav = useCallback((recipe) => {
    const isFav = state.favorites.some(r => r.id === recipe.id)
    isFav ? dispatch(removeFromFavorites(recipe.id)) : dispatch(addToFavorites(recipe))
  }, [state.favorites, dispatch])

  const Card = ({ item }) => (
    <RecipeCard recipe={item.recipe} match={item.match} isFavorite={state.favorites.some(r => r.id === item.recipe.id)} onPress={() => openRecipe(item)} onToggleFavorite={() => toggleFav(item.recipe)} showMatchInfo={true} />
  )

  const Header = () => (
    <View style={styles.header}>
      <Text style={styles.title}>My Favorites</Text>
      <Text style={styles.count}>{state.favorites.length === 0 ? 'No favorites yet' : `${state.favorites.length} favorite recipes`}</Text>
    </View>
  )

  const Empty = () => (
    <EmptyState icon="heart-outline" title="No favorite recipes yet" description="Tap the heart icon on recipes to save them here" actionText="Discover Recipes" onActionPress={() => nav.navigate('Matches')} />
  )

  return (
    <SafeAreaView style={styles.main}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      {recipes.length > 0 ? (
        <FlatList data={recipes} renderItem={Card} keyExtractor={i => i.recipe.id} ListHeaderComponent={Header} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007AFF" />} showsVerticalScrollIndicator={false} contentContainerStyle={styles.list} />
      ) : (
        <View style={styles.main}>
          <Header />
          {loading ? (<View style={styles.loading}><LoadingDots text="Loading favorites" color="#007AFF" /></View>) : <Empty />}
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: '#f8f9fa', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { backgroundColor: 'white', paddingTop: 16, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333', paddingHorizontal: 16, marginBottom: 4 },
  count: { fontSize: 16, color: '#666', paddingHorizontal: 16 },
  list: { paddingBottom: 20 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' }
})

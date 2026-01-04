import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, StatusBar, TouchableOpacity, Alert, Share } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { useStore, addToFavorites, removeFromFavorites, addToShoppingList, showSnackbar, hideSnackbar, updateGeneratedRecipe } from '../services/store'
import { Badge } from '../components/Badge'
import { ListItem } from '../components/ListItem'
import { Snackbar } from '../components/Snackbar'
import { getRecipe, checkRecipeMatch, makePantrySet, getMissingForShopping } from '../services/recipes'
import { convertIngredientsToIndianUnits } from '../utils/unitConverter'
import { LoadingDots } from '../components/LoadingDots'

export default function RecipeDetail() {
  const nav = useNavigation()
  const route = useRoute()
  const { id } = route.params
  const { state, dispatch } = useStore()
  const [recipe, setRecipe] = useState(null)
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadRecipe = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      if (state.currentRecipe && state.currentRecipe.recipe.id === id && state.currentRecipe.recipe.steps?.length > 0) {
        setRecipe(state.currentRecipe.recipe)
        setMatch(state.currentRecipe.match)
      } else {
        const data = await getRecipe(id, state.currentRecipe?.recipe)
        if (data) {
          const converted = { ...data, ingredients: convertIngredientsToIndianUnits(data.ingredients || []) }
          setRecipe(converted)
          const pantrySet = makePantrySet(state.pantry.items)
          const recipeMatch = checkRecipeMatch(converted, pantrySet)
          setMatch(recipeMatch)
          dispatch(updateGeneratedRecipe({ ...data, match: recipeMatch }))
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to load recipe.')
    } finally {
      setLoading(false)
    }
  }, [id, state.currentRecipe, state.pantry.items, dispatch])

  useEffect(() => { loadRecipe() }, [loadRecipe])

  const toggleFav = useCallback(() => {
    if (!recipe) return
    const isFav = state.favorites.some(r => r.id === recipe.id)
    isFav ? dispatch(removeFromFavorites(recipe.id)) : dispatch(addToFavorites(recipe))
  }, [recipe, state.favorites, dispatch])

  const addMissing = useCallback(() => {
    if (!match || !match.missingIngredients?.length) {
      dispatch(showSnackbar('You have all ingredients!', null, null))
      return
    }
    const items = getMissingForShopping(match, recipe.title, recipe.ingredients)
    dispatch(addToShoppingList(items))
    dispatch(showSnackbar(`Added ${items.length} to shopping list`, 'View', () => nav.navigate('Shopping')))
  }, [match, recipe, dispatch, nav])

  const goBack = useCallback(() => nav.goBack(), [nav])

  const share = useCallback(async () => {
    if (!recipe) return
    try {
      const msg = `Check out this recipe: ${recipe.title}\n\nIngredients:\n${recipe.ingredients.map(i => `• ${i.qty} ${i.unit} ${i.name}`).join('\n')}\n\nShared from MinuteMeals`
      await Share.share({ message: msg, title: recipe.title })
    } catch (err) { }
  }, [recipe])

  if (loading) {
    return (
      <SafeAreaView style={styles.main}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <View style={styles.loading}><LoadingDots text="Loading recipe" color="#007AFF" /></View>
      </SafeAreaView>
    )
  }

  if (!recipe) {
    return (
      <SafeAreaView style={styles.box}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <View style={styles.error}>
          <Text style={styles.errorText}>Recipe not found</Text>
          <TouchableOpacity style={styles.backBtn} onPress={goBack}><Text style={styles.backText}>Go Back</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const isFav = state.favorites.some(r => r.id === recipe.id)
  const isMatched = (name) => match?.matchedIngredients.some(i => i.name.trim().toLowerCase() === name.trim().toLowerCase())

  return (
    <SafeAreaView style={styles.box}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <TouchableOpacity style={styles.iconBtn} onPress={goBack}><Ionicons name="arrow-back" size={24} color="#333" /></TouchableOpacity>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.iconBtn} onPress={toggleFav}><Ionicons name={isFav ? "heart" : "heart-outline"} size={24} color={isFav ? "#007AFF" : "#666"} /></TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={share}><Ionicons name="share-outline" size={24} color="#666" /></TouchableOpacity>
          </View>
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>{recipe.title}</Text>
          <View style={styles.meta}>
            <View style={styles.metaItem}><Ionicons name="time-outline" size={16} color="#666" /><Text style={styles.metaText}>{recipe.timeMinutes ? `${recipe.timeMinutes} min` : 'Time unknown'}</Text></View>
            {recipe.difficulty && <View style={styles.metaItem}><Ionicons name="bar-chart-outline" size={16} color="#666" /><Text style={styles.metaText}>{recipe.difficulty}</Text></View>}
          </View>
          {match && (
            <View style={styles.matchBox}>
              <View style={styles.matchTop}>
                {match.cookNow ? <Badge text="Ready to Cook!" variant="cookNow" /> : <Badge text={`${match.missingCount} missing`} variant="missing" />}
                <Text style={styles.matchScore}>{match.matchedCount}/{match.totalIngredients} ingredients</Text>
              </View>
              <TouchableOpacity style={[styles.mainBtn, match.cookNow ? styles.cookBtn : styles.shopBtn]} onPress={match.cookNow ? null : addMissing}>
                <Ionicons name={match.cookNow ? "restaurant" : "add-circle"} size={20} color="white" />
                <Text style={styles.mainText}>{match.cookNow ? "Ready to Cook!" : "Add Missing to Shopping"}</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {recipe.ingredients.map((ing, i) => (
              <ListItem key={`${ing.name}_${i}`} title={ing.name} subtitle={ing.qty ? (ing.unit ? `${ing.qty} ${ing.unit}` : `${ing.qty}`) : undefined} leftIcon={<View style={[styles.dot, { backgroundColor: isMatched(ing.name) ? '#28a745' : '#ffc107' }]} />} style={styles.ingItem} />
            ))}
          </View>
          {recipe.steps?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Instructions</Text>
              {recipe.steps.map((step, i) => (
                <View key={`step_${i}`} style={styles.step}>
                  <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      <Snackbar visible={state.snackbar.visible} message={state.snackbar.message} actionText={state.snackbar.actionText} onActionPress={state.snackbar.onActionPress} onDismiss={() => dispatch(hideSnackbar())} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: '#f8f9fa' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  box: { flex: 1, backgroundColor: 'white' },
  error: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  errorText: { fontSize: 18, color: '#666', marginBottom: 16 },
  backBtn: { backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backText: { color: 'white', fontSize: 16, fontWeight: '600' },
  scroll: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  actions: { flexDirection: 'row', gap: 12 },
  iconBtn: { backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 12, lineHeight: 30 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 14, color: '#666' },
  matchBox: { backgroundColor: '#f8f9fa', borderRadius: 12, padding: 16, marginBottom: 24 },
  matchTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  matchScore: { fontSize: 12, color: '#666' },
  mainBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 12, gap: 8, marginTop: 12 },
  cookBtn: { backgroundColor: '#28a745' },
  shopBtn: { backgroundColor: '#007AFF' },
  mainText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  ingItem: { backgroundColor: '#f8f9fa', marginBottom: 1 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  step: { flexDirection: 'row', marginBottom: 16, paddingRight: 8 },
  stepNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2 },
  stepNumText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  stepText: { flex: 1, fontSize: 16, color: '#333', lineHeight: 22 }
})

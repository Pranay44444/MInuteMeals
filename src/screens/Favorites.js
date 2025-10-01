import React,{useEffect,useState,useCallback} from 'react'
import {View,Text,FlatList,StyleSheet,SafeAreaView,StatusBar,RefreshControl,Alert} from 'react-native'
import {useNavigation} from '@react-navigation/native'
import {useStore,setCurrentRecipe,removeFromFavorites,addToFavorites} from '../services/store'
import {RecipeCard} from '../components/RecipeCard'
import {EmptyState} from '../components/EmptyState'
import {getRecipe,checkRecipeMatch,makePantrySet} from '../services/recipes'

export default function Favorites(){
  const navigation = useNavigation()
  const {state,dispatch} = useStore()
  const [recipes,setRecipes] = useState([])
  const [loading,setLoading] = useState(false)
  const [refreshing,setRefreshing] = useState(false)

  const loadRecipes = useCallback(async ()=>{
    const hasFavorites = state.favorites.length > 0
    if (!hasFavorites){
      setRecipes([])
      return
    }
    setLoading(true)
    try{
      const pantrySet = makePantrySet(state.pantry.items)
      const recipePromises = state.favorites.map(async (recipeId)=>{
        try{
          const recipe = await getRecipe(recipeId)
          const hasRecipe = recipe
          if (hasRecipe){
            const match = checkRecipeMatch(recipe,pantrySet)
            return {recipe,match}
          }
          return null
        }
        catch(error){
          return null
        }
      })
      const results = await Promise.all(recipePromises)
      const validRecipes = results.filter((result)=> result !== null)
      setRecipes(validRecipes)
    } 
    catch(error){
      Alert.alert('Error','Failed to load favorite recipes. Please try again.')
    } 
    finally{
      setLoading(false)
    }
  },[state.favorites,state.pantry.items])

  useEffect(()=>{
    loadRecipes()
  },[loadRecipes])

  const pullRefresh = useCallback(async ()=>{
    setRefreshing(true)
    await loadRecipes()
    setRefreshing(false)
  },[loadRecipes])

  const clickRecipe = useCallback((item)=>{
    dispatch(setCurrentRecipe({
      recipe: item.recipe,
      match: item.match
    }))
    navigation.navigate('RecipeDetail',{id: item.recipe.id})
  },[dispatch])

  const clickHeart = useCallback((recipeId)=>{
    const isFavorite = state.favorites.includes(recipeId)
    if (isFavorite){
      dispatch(removeFromFavorites(recipeId))
    } else {
      dispatch(addToFavorites(recipeId))
    }
  },[state.favorites,dispatch])

  const showCard = ({item})=>(
    <RecipeCard
      recipe={item.recipe}
      match={item.match}
      isFavorite={state.favorites.includes(item.recipe.id)}
      onPress={()=>clickRecipe(item)}
      onToggleFavorite={clickHeart}
      showMatchInfo={true}/>
  )

  const showTop = ()=>{
    const count = state.favorites.length
    const hasNone = count===0
    return (
      <View style={styles.top}>
        <Text style={styles.title}>My Favorites</Text>
        <Text style={styles.sub}>
          {hasNone ? 'No favorites yet' : `${count} favorite recipes`}
        </Text>
      </View>
    )
  }

  const showEmpty = ()=>(
    <EmptyState
      icon="heart-outline"
      title="No favorite recipes yet"
      description="Tap the heart icon on recipes you love to save them here"
      actionText="Discover Recipes"
      onActionPress={()=>navigation.navigate('Matches')}
    />
  )
  const hasRecipes = recipes.length > 0

  return (
    <SafeAreaView style={styles.main}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      {hasRecipes ? (
        <FlatList
          data={recipes}
          renderItem={showCard}
          keyExtractor={(item)=>item.recipe.id}
          ListHeaderComponent={showTop}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={pullRefresh}
              tintColor="#007AFF"/>}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        />
      ) : (
        <View style={styles.main}>
          {showTop()}
          {loading ? (
            <View style={styles.load}>
              <Text style={styles.loadText}>Loading favorites...</Text>
            </View>
          ) : (
            showEmpty()
          )}
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  },
  top: {
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
  sub: {
    fontSize: 16,
    color: '#666',
    paddingHorizontal: 16
  },
  list: {
    paddingBottom: 20
  },
  load: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadText: {
    fontSize: 16,
    color: '#666'
  }
})

import React,{useEffect,useState,useCallback} from 'react'
import {View,Text,ScrollView,StyleSheet,StatusBar,TouchableOpacity,Alert,Share} from 'react-native'
import {SafeAreaView} from 'react-native-safe-area-context'
import {useNavigation,useRoute} from '@react-navigation/native'
import {Ionicons} from '@expo/vector-icons'
import {useStore,addToFavorites,removeFromFavorites,addToShoppingList,showSnackbar,hideSnackbar} from '../services/store'
import {Badge} from '../components/Badge'
import {ListItem} from '../components/ListItem'
import {Snackbar} from '../components/Snackbar'
import {getRecipe} from '../services/recipes'
import {checkRecipeMatch,makePantrySet,getMissingForShopping} from '../services/recipes'

export default function RecipeDetail(){
  const navigation = useNavigation()
  const route = useRoute()
  const {id} = route.params
  const {state,dispatch} = useStore()
  const [recipe,setRecipe] = useState(null)
  const [match,setMatch] = useState(null)
  const [loading,setLoading] = useState(true)

  const loadRecipe = useCallback(async ()=>{
    if (!id) return
    setLoading(true)
    try{
      if (state.currentRecipe && state.currentRecipe.recipe.id === id){
        setRecipe(state.currentRecipe.recipe)
        setMatch(state.currentRecipe.match)
      }
      else{
        const fetchedRecipe = await getRecipe(id)
        if (fetchedRecipe){
          setRecipe(fetchedRecipe)
          const pantrySet = makePantrySet(state.pantry.items)
          const recipeMatch = checkRecipeMatch(fetchedRecipe,pantrySet)
          setMatch(recipeMatch)
        }
      }
    }
    catch(error){
      console.error('Error loading recipe:',error)
      Alert.alert('Error','Failed to load recipe details.')
    }
    finally{
      setLoading(false)
    }
  },[id,state.currentRecipe,state.pantry.items])

  useEffect(()=>{
    loadRecipe()
  },[loadRecipe])

  const clickHeart = useCallback(()=>{
    if (!recipe){
      return
    }
    if (state.favorites.includes(recipe.id)){
      dispatch(removeFromFavorites(recipe.id))
    }
    else{
      dispatch(addToFavorites(recipe.id))
    }
  },[recipe,state.favorites,dispatch])

  const clickAddMissing = useCallback(()=>{
    if (!match || !match.missingIngredients || match.missingIngredients.length === 0){
      dispatch(showSnackbar(
        'You have all the ingredients needed for this recipe!',null,null
      ))
      return
    }
    const shoppingItems = getMissingForShopping(match,recipe.title)
    dispatch(addToShoppingList(shoppingItems))
    dispatch(showSnackbar(
      `Added ${shoppingItems.length} ingredients to shopping list`,
      'VIEW LIST',
      ()=> navigation.navigate('Shopping')
    ))
  },[match,recipe,dispatch])

  const clickBack = useCallback(()=>{
    navigation.goBack()
  },[navigation])
  const clickShare = useCallback(async ()=>{
    if (!recipe){
      return
    }
    try{
      const message = `Check out this recipe: ${recipe.title}\n\nIngredients:\n${recipe.ingredients.map(ing => `• ${ing.qty} ${ing.unit} ${ing.name}`).join('\n')}\n\nShared from MinuteMeals`
      await Share.share({message,title: recipe.title,})
    }
    catch(error){
      console.error('Error sharing recipe:',error)
    }
  },[recipe])

  if (loading){
    return (
      <SafeAreaView style={styles.main}>
        <StatusBar barStyle="dark-content" backgroundColor="white"/>
        <View style={styles.loadBox}>
          <Text style={styles.loadText}>Loading recipe...</Text>
        </View>
      </SafeAreaView>
    )
  }
  if (!recipe){
    return (
      <SafeAreaView style={styles.main}>
        <StatusBar barStyle="dark-content" backgroundColor="white"/>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Recipe not found</Text>
          <TouchableOpacity style={styles.backBtn} onPress={clickBack}>
            <Text style={styles.backText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const isFavorite = state.favorites.includes(recipe.id)
  const showIngredient = ({item,index})=>(
    <ListItem
      key={index}
      title={item.name}
      subtitle={item.qty && item.unit ? `${item.qty} ${item.unit}` : undefined}
      leftIcon={
        <View style={[
          styles.ingredientDot,
          {backgroundColor: match?.matchedIngredients.includes(item) ? '#28a745' : '#ffc107'}
        ]}/>
      }
      style={styles.ingredientItem}
    />
  )

  const showStep = ({item,index})=>(
    <View key={index} style={styles.stepBox}>
      <View style={styles.stepNum}>
        <Text style={styles.stepNumText}>{index+1}</Text>
      </View>
      <Text style={styles.stepText}>{item}</Text>
    </View>
  )

  return (
    <SafeAreaView style={styles.main}>
      <StatusBar barStyle="dark-content" backgroundColor="white"/>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={clickBack}>
            <Ionicons name="arrow-back" size={24} color="#333"/>
          </TouchableOpacity>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.heartBtn} onPress={clickHeart}>
              <Ionicons 
                name={isFavorite ? "heart" : "heart-outline"} 
                size={24} 
                color={isFavorite ? "#007AFF" : "#666"} 
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn} onPress={clickShare}>
              <Ionicons name="share-outline" size={24} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>{recipe.title}</Text>
          <View style={styles.meta}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={16} color="#666" />
              <Text style={styles.metaText}>
                {recipe.timeMinutes ? `${recipe.timeMinutes} min` : 'Time unknown'}
              </Text>
            </View>
            {recipe.difficulty && (
              <View style={styles.metaItem}>
                <Ionicons name="bar-chart-outline" size={16} color="#666" />
                <Text style={styles.metaText}>{recipe.difficulty}</Text>
              </View>
            )}
          </View>
          {match && (
            <View style={styles.matchBox}>
              <View style={styles.matchTop}>
                {match.cookNow ? (
                  <Badge text="Ready to Cook!" variant="cookNow" />
                ) : (
                  <Badge text={`${match.missingCount} ingredients missing`} variant="missing" />
                )}
                <Text style={styles.matchScore}>
                  {match.matchedCount}/{match.totalIngredients} ingredients
                </Text>
              </View>
              <TouchableOpacity 
                style={[
                  styles.mainBtn,
                  match.cookNow ? styles.cookBtn : styles.shopBtn
                ]} 
                onPress={match.cookNow ? null : clickAddMissing}>
                <Ionicons 
                  name={match.cookNow ? "restaurant" : "add-circle"} 
                  size={20} 
                  color="white" />
                <Text style={styles.mainBtnText}>
                  {match.cookNow ? "Ready to Cook!" : "Add Missing to Shopping List"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {recipe.ingredients.map((ingredient,index)=> showIngredient({item: ingredient,index}))}
          </View>
          {recipe.steps && recipe.steps.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Instructions</Text>
              {recipe.steps.map((step,index)=> showStep({item: step,index}))}
            </View>
          )}
        </View>
      </ScrollView>
      <Snackbar
        visible={state.snackbar.visible}
        message={state.snackbar.message}
        actionText={state.snackbar.actionText}
        onActionPress={state.snackbar.onActionPress}
        onDismiss={() => dispatch(hideSnackbar())}/>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
    backgroundColor: 'white',
  },
  loadBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadText: {
    fontSize: 16,
    color: '#666',
  },
  errorBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 16,
  },
  backBtn: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  heartBtn: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtn: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    lineHeight: 30,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 14,
    color: '#666',
  },
  matchBox: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  matchTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  matchScore: {
    fontSize: 12,
    color: '#666',
  },
  mainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 12,
  },
  cookBtn: {
    backgroundColor: '#28a745',
  },
  shopBtn: {
    backgroundColor: '#007AFF',
  },
  mainBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  ingredientItem: {
    backgroundColor: '#f8f9fa',
    marginBottom: 1,
  },
  ingredientDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stepBox: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingRight: 8,
  },
  stepNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepNumText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  stepText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
})

import React,{useEffect,useState,useCallback,useRef} from 'react'
import {View,Text,FlatList,StyleSheet,RefreshControl,Alert,SafeAreaView,StatusBar,TouchableOpacity} from 'react-native'
import {useFocusEffect,useNavigation} from '@react-navigation/native'
import {useStore,setCurrentRecipe,setRecipes,setLoading,setError,setFilter,resetFilters,addToFavorites,removeFromFavorites} from '../services/store'
import {FilterBar} from '../components/FilterBar'
import {RecipeCard} from '../components/RecipeCard'
import {RecipeSkeleton} from '../components/RecipeSkeleton'
import {EmptyState} from '../components/EmptyState'
import {findRecipes,normalizeIngredient,processRecipes,getFilters} from '../services/recipes'

export default function Matches(){
  const navigation = useNavigation()
  const {state,dispatch} = useStore()
  const [refreshing,setRefreshing] = useState(false)
  const [recipesWithMatches,setRecipesWithMatches] = useState([])
  const [filterOptions,setFilterOptions] = useState({})
  const [isLoading,setIsLoading] = useState(false)
  const abortControllerRef = useRef(null)
  const requestIdRef = useRef(0)
  const pantryKey = state.pantry.items
    .map(name => normalizeIngredient(name))
    .sort()
    .join(',')
  const filtersKey = JSON.stringify({
    vegMode: state.filters.isVegetarian,
    maxTime: state.filters.maxTime,
    difficulty: state.filters.difficulty,
  })

  const loadRecipes = useCallback(async (forceRefresh=false)=>{
    if (abortControllerRef.current){
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()
    const currentRequestId = ++requestIdRef.current
    setIsLoading(true)
    dispatch(setLoading(true))
    dispatch(setError(null))
    try{
      let recipes = []
      const options = {signal: abortControllerRef.current.signal}
      if (state.pantry.items.length >= 1){
        const result = await findRecipes(state.pantry.items,state.filters,options)
        recipes = result.recipes || []
      }
      if (currentRequestId===requestIdRef.current){
        const recipesWithMatchData = processRecipes(recipes,state.pantry.items)
        setRecipesWithMatches(recipesWithMatchData)
        setFilterOptions(getFilters(recipes))
        dispatch(setRecipes(recipes))
      }
    }
    catch(error){
      if (currentRequestId === requestIdRef.current && error.name !== 'AbortError'){
        console.error('Error loading recipes:',error)
        dispatch(setError('Failed to load recipes. Please try again.'))
        if (forceRefresh){
          Alert.alert('Error','Failed to load recipes. Please check your connection and try again.')
        }
      }
    }
    finally{
      if (currentRequestId === requestIdRef.current){
        setIsLoading(false)
        dispatch(setLoading(false))
      }
    }
  },[state.pantry.items,state.filters,dispatch])

  useEffect(() => {
    loadRecipes()
  },[pantryKey,filtersKey])

  useFocusEffect(
    useCallback(() => {
      loadRecipes()
    },[loadRecipes])
  )

  useEffect(()=>{
    return ()=>{
      if (abortControllerRef.current){
        abortControllerRef.current.abort()
      }
    }
  },[])

  const pullRefresh = useCallback(async ()=>{
    setRefreshing(true)
    await loadRecipes(true)
    setRefreshing(false)
  },[loadRecipes])

  const clickRecipe = useCallback((item)=>{
    dispatch(setCurrentRecipe({
      recipe: item.recipe,
      match: item.match,
    }))
    navigation.navigate('RecipeDetail',{id: item.recipe.id})
  },[dispatch])

  const clickHeart = useCallback((recipeId)=>{
    if (state.favorites.includes(recipeId)){
      dispatch(removeFromFavorites(recipeId))
    }else{
      dispatch(addToFavorites(recipeId))
    }
  },[state.favorites,dispatch])

  const changeFilter = useCallback((filterType,value)=>{
    dispatch(setFilter(filterType,value))
  },[dispatch])

  const clearFilters = useCallback(() => {
    dispatch(resetFilters())
  },[dispatch])

  const showSkeletons = () => {
    return Array.from({length: 6},(_,index) => (
      <RecipeSkeleton key={`skeleton-${index}`} />
    ))
  }

  const showSectionHeader = (title,count)=>(
    <View style={styles.section}>
      <Text style={styles.secTitle}>{title}</Text>
      <Text style={styles.secCount}>({count})</Text>
    </View>
  )

  const showEmptyPantry = ()=>(
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
    if (state.pantry.items.length === 0){
      return showEmptyPantry()
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

  const showCard = ({item})=>{
    if (item.type === 'section-header'){
      return showSectionHeader(item.title,item.count)
    }
    return (
      <RecipeCard
        recipe={item.recipe}
        match={item.match}
        isFavorite={state.favorites.includes(item.recipe.id)}
        onPress={() => clickRecipe(item)}
        onToggleFavorite={() => clickHeart(item.recipe.id)}
      />
    )
  }

  const prepareData = ()=>{
    if (isLoading){
      return showSkeletons().map((skeleton,index)=>({ 
        key: `skeleton-${index}`, 
        type: 'skeleton',
        component: skeleton 
      }))
    }

    if (recipesWithMatches.length === 0){
      return []
    }
    const data = []
    if (state.pantry.items.length === 0){
      return data
    }else{
      const cookNowRecipes = recipesWithMatches
        .filter(item => item.match.missingCount === 0)
        .sort((a,b)=> b.match.matchedCount - a.match.matchedCount)
      const almostThereRecipes = recipesWithMatches
        .filter(item => 
          item.match.missingCount > 0 && 
          item.match.missingCount <= 5 &&
          item.match.matchedCount > 0
        )
        .sort((a,b)=>{
          if (b.match.matchedCount !== a.match.matchedCount){
            return b.match.matchedCount - a.match.matchedCount
          }
          return a.match.missingCount - b.match.missingCount
        })
      if (cookNowRecipes.length > 0){
        data.push({
          key: 'cook-now-header',
          type: 'section-header',
          title: 'Cook Now',
          count: cookNowRecipes.length,
        })
        cookNowRecipes.forEach((item,index)=>{
          data.push({...item,key: `cook-now-${index}`})
        })
      }
      if (almostThereRecipes.length > 0){
        data.push({
          key: 'almost-there-header',
          type: 'section-header',
          title: 'Almost There',
          count: almostThereRecipes.length,
        })
        almostThereRecipes.forEach((item,index)=>{
          data.push({...item,key: `almost-there-${index}`})
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
      {isLoading && flatListData.length === 0 ? (
        <View style={styles.skeletons}>
          {showSkeletons()}
        </View>
      ) : flatListData.length === 0 ? (
        showEmpty()
      ) : (
        <FlatList
          data={flatListData}
          keyExtractor={(item) => item.key}
          renderItem={({item}) => {
            if (item.type === 'skeleton'){
              return item.component
            }
            return showCard({item})
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={pullRefresh} />
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
})
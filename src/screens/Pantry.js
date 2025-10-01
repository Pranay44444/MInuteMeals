import React,{useState,useCallback} from 'react'
import {View,Text,FlatList,StyleSheet,SafeAreaView,StatusBar,TouchableOpacity,Alert} from 'react-native'
import {useNavigation} from '@react-navigation/native'
import {Ionicons} from '@expo/vector-icons'
import {useStore,addToPantry,removeFromPantry,setPantry} from '../services/store'
import {SearchBar} from '../components/SearchBar'
import {ListItem} from '../components/ListItem'
import {EmptyState} from '../components/EmptyState'
import {debounce} from '../utils/debounce'

const COMMON_INGREDIENTS = [
  'onion','garlic','tomato','potato','carrot','bell pepper',
  'chicken breast','ground beef','salmon','eggs','milk','cheese',
  'rice','pasta','bread','flour','olive oil','butter',
  'salt','black pepper','basil','oregano','cumin','paprika',
  'lemon','lime','ginger','mushrooms','spinach','broccoli'
]

export default function Pantry(){
  const navigation = useNavigation()
  const {state,dispatch} = useStore()
  const [searchText,setSearchText] = useState('')
  const [suggestions,setSuggestions] = useState([])
  const [showSuggestions,setShowSuggestions] = useState(false)

  const delayedSearch = useCallback(
    debounce((text)=>{
      if (text.trim().length > 0){
        const filtered = COMMON_INGREDIENTS.filter((ingredient)=>
          ingredient.toLowerCase().includes(text.toLowerCase()) &&
          !state.pantry.items.includes(ingredient)
        ).slice(0,10)
        setSuggestions(filtered)
        setShowSuggestions(true)
      }
      else{
        setSuggestions([])
        setShowSuggestions(false)
      }
    },300),
    [state.pantry.items]
  )

  const changeSearch = useCallback((text)=>{
    setSearchText(text)
    delayedSearch(text)
  },[delayedSearch])

  const addItem = useCallback((ingredient)=>{
    const cleanItem = ingredient.trim().toLowerCase()
    if (cleanItem && !state.pantry.items.includes(cleanItem)){
      dispatch(addToPantry(cleanItem))
      setSearchText('')
      setSuggestions([])
      setShowSuggestions(false)
    }
  },[state.pantry.items,dispatch])

  const removeItem = useCallback((ingredient)=>{
    dispatch(removeFromPantry(ingredient))
  },[dispatch])

  const clickSearch = useCallback(()=>{
    if (searchText.trim()){
      addItem(searchText)
    }
  },[searchText,addItem])

  const clickScan = useCallback(async ()=>{
    Alert.alert(
      'Scan Items',
      'This feature is coming soon! It will use AI to identify ingredients from a photo of your items.',
      [{text: 'OK',style: 'cancel'}]
    )
  },[])

  const clickClear = useCallback(() => {
    Alert.alert(
      'Clear Pantry',
      'Are you sure you want to remove all ingredients from your pantry?',
      [
        {text: 'Cancel',style: 'cancel'},
        {text: 'Clear',style: 'destructive',onPress: ()=>dispatch(setPantry([])),},
      ]
    )
  },[dispatch])

  const showPantryItem = ({item})=>(
    <ListItem
      title={item}
      rightIcon={
        <Ionicons name="close" size={20} color="#FF3B30" />
      }
      onRightIconPress={()=> removeItem(item)}/>
  )

  const showSuggestion = ({item})=>(
    <ListItem
      title={item}
      leftIcon={
        <Ionicons name="add-circle-outline" size={20} color="#007AFF"/>
      }
      onPress={()=> addItem(item)}
      style={styles.suggestionItem}
    />
  )

  const showTop = ()=>(
    <View style={styles.top}>
      <Text style={styles.title}>My Pantry</Text>
      <Text style={styles.sub}>
        {state.pantry.items.length} ingredients
      </Text>
      <SearchBar
        placeholder="Add ingredients..."
        value={searchText}
        onChangeText={changeSearch}
        onSearch={clickSearch}
        autoFocus={false}/>
      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.action,styles.disabled]} 
          onPress={clickScan}>
          <Ionicons name="camera" size={20} color="#999" />
          <Text style={[styles.actionText,styles.disabledText]}>Scan Items (coming soon)</Text>
        </TouchableOpacity>
        {state.pantry.items.length > 0 && (
          <TouchableOpacity 
            style={[styles.action,styles.clear]} 
            onPress={clickClear}>
            <Ionicons name="trash-outline" size={20} color="#dc3545" />
            <Text style={[styles.actionText,styles.clearText]}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )

  const showContent = ()=>{
    if (showSuggestions && suggestions.length > 0){
      return (
        <View style={styles.suggestBox}>
          <Text style={styles.suggestTitle}>Suggestions</Text>
          <FlatList
            data={suggestions}
            renderItem={showSuggestion}
            keyExtractor={(item)=> item}
            style={styles.suggestList}/>
        </View>
      )
    }
    if (state.pantry.items.length === 0){
      return (
        <EmptyState
          icon="basket-outline"
          title="Your pantry is empty"
          description="Add ingredients you have at home to find matching recipes"
          actionText="Add Your First Ingredient"
          onActionPress={() => {
            Alert.alert('Add Ingredients','Use the search bar above to add ingredients to your pantry!')
          }}
        />
      )
    }

    return (
      <FlatList
        data={state.pantry.items}
        renderItem={showPantryItem}
        keyExtractor={(item) => item}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListFooterComponent={
          state.pantry.items.length > 0 ? (
            <TouchableOpacity 
              style={styles.findButton} 
              onPress={() => navigation.navigate('Matches')}>
              <Text style={styles.findText}>Find Recipes</Text>
            </TouchableOpacity>
          ) : null
        }
      />
    )
  }

  return (
    <SafeAreaView style={styles.main}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      {showTop()}
      {showContent()}
    </SafeAreaView>
  )
}


const styles = StyleSheet.create({
  main: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  top: {
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
  sub: {
    fontSize: 16,
    color: '#666',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  action: {
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
  },
  findText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  suggestBox: {
    flex: 1,
    backgroundColor: 'white',
  },
  suggestTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
  },
  suggestList: {
    flex: 1,
  },
  suggestionItem: {
    backgroundColor: '#fafafa',
  },
  list: {
    paddingBottom: 20,
  },
})

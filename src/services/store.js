import React, { createContext, useContext, useReducer, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { hasKey } from '../utils/env'

const initialState = {
  pantry: { items: [], lastUpdated: null },
  favorites: [],
  shoppingList: [],
  recipes: [],
  currentRecipe: null,
  filters: {
    isVegetarian: null,
    difficulty: null,
    maxTime: null,
    searchQuery: ''
  },
  ui: {
    isLoading: false,
    error: null,
    hasKey: false,
    showDemoDataBanner: true
  },
  snackbar: {
    visible: false,
    message: '',
    actionText: null,
    onActionPress: null
  }
}

const save = async (key, data) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    // Error saving data
  }
}

const load = async (key, fallback = []) => {
  try {
    const data = await AsyncStorage.getItem(key)
    return data ? JSON.parse(data) : fallback
  } catch (error) {
    return fallback
  }
}

const mergeItems = (items) => {
  const merged = {}
  items.forEach(item => {
    if (!item || !item.name) {
      return
    }
    const key = item.name.toLowerCase()
    if (merged[key]) {
      merged[key].quantity += item.quantity || 1
    } else {
      merged[key] = { ...item }
    }
  })
  return Object.values(merged)
}

const reducer = (state, action) => {
  switch (action.type) {
    case 'ADD_TO_PANTRY':
      if (state.pantry.items.includes(action.payload)) {
        return state
      }
      return {
        ...state,
        pantry: {
          items: [...state.pantry.items, action.payload],
          lastUpdated: Date.now()
        }
      }
    case 'REMOVE_FROM_PANTRY':
      return {
        ...state,
        pantry: {
          items: state.pantry.items.filter(item => item !== action.payload),
          lastUpdated: Date.now()
        }
      }
    case 'SET_PANTRY':
      return {
        ...state,
        pantry: {
          items: Array.isArray(action.payload) ? action.payload : action.payload.items || [],
          lastUpdated: Date.now()
        }
      }
    case 'ADD_TO_FAVORITES':
      if (state.favorites.includes(action.payload)) {
        return state
      }
      return {
        ...state,
        favorites: [...state.favorites, action.payload]
      }
    case 'REMOVE_FROM_FAVORITES':
      return {
        ...state,
        favorites: state.favorites.filter(id => id !== action.payload)
      }
    case 'SET_FAVORITES':
      return {
        ...state,
        favorites: action.payload
      }
    case 'ADD_TO_SHOPPING_LIST':
      return {
        ...state,
        shoppingList: mergeItems([...state.shoppingList, ...action.payload])
      }
    case 'REMOVE_FROM_SHOPPING_LIST':
      return {
        ...state,
        shoppingList: state.shoppingList.filter(item => item.id !== action.payload)
      }
    case 'UPDATE_SHOPPING_ITEM':
      return {
        ...state,
        shoppingList: state.shoppingList.map(item =>
          item.id === action.payload.id ? { ...item, ...action.payload } : item
        )
      }
    case 'MARK_SHOPPING_ITEM_BOUGHT':
      return {
        ...state,
        shoppingList: state.shoppingList.map(item =>
          item.id === action.payload.itemId
            ? { ...item, bought: action.payload.bought }
            : item
        )
      }
    case 'MOVE_BOUGHT_TO_PANTRY':
      const boughtItems = state.shoppingList.filter(item => item.bought)
      const newPantryItems = boughtItems.map(item => item.name)
      const remainingShoppingItems = state.shoppingList.filter(item => !item.bought)
      return {
        ...state,
        pantry: {
          items: [...new Set([...state.pantry.items, ...newPantryItems])],
          lastUpdated: Date.now()
        },
        shoppingList: remainingShoppingItems
      }
    case 'SET_SHOPPING_LIST':
      return {
        ...state,
        shoppingList: action.payload
      }
    case 'SET_LOADING':
      return {
        ...state,
        ui: { ...state.ui, isLoading: action.payload }
      }
    case 'SET_ERROR':
      return {
        ...state,
        ui: { ...state.ui, error: action.payload }
      }
    case 'SET_API_KEY_STATUS':
      return {
        ...state,
        ui: { ...state.ui, hasKey: action.payload }
      }
    case 'SET_DEMO_DATA_BANNER':
      return {
        ...state,
        ui: { ...state.ui, showDemoDataBanner: action.payload }
      }
    case 'SET_FILTER':
      return {
        ...state,
        filters: {
          ...state.filters,
          [action.payload.filterType]: action.payload.value
        }
      }
    case 'RESET_FILTERS':
      return {
        ...state,
        filters: initialState.filters
      }
    case 'SET_RECIPES':
      return {
        ...state,
        recipes: action.payload
      }
    case 'SET_CURRENT_RECIPE':
      return {
        ...state,
        currentRecipe: action.payload
      }
    case 'SHOW_SNACKBAR':
      return {
        ...state,
        snackbar: {
          visible: true,
          message: action.payload.message,
          actionText: action.payload.actionText,
          onActionPress: action.payload.onActionPress
        }
      }
    case 'HIDE_SNACKBAR':
      return {
        ...state,
        snackbar: {
          ...state.snackbar,
          visible: false
        }
      }
    default:
      return state
  }
}

export const addToPantry = (ingredient) => ({
  type: 'ADD_TO_PANTRY',
  payload: ingredient
})

export const removeFromPantry = (ingredient) => ({
  type: 'REMOVE_FROM_PANTRY',
  payload: ingredient
})

export const setPantry = (pantry) => ({
  type: 'SET_PANTRY',
  payload: pantry
})

export const addToFavorites = (recipeId) => ({
  type: 'ADD_TO_FAVORITES',
  payload: recipeId
})

export const removeFromFavorites = (recipeId) => ({
  type: 'REMOVE_FROM_FAVORITES',
  payload: recipeId
})

export const setFavorites = (favorites) => ({
  type: 'SET_FAVORITES',
  payload: favorites
})

export const addToShoppingList = (items) => ({
  type: 'ADD_TO_SHOPPING_LIST',
  payload: Array.isArray(items) ? items : [items]
})

export const removeFromShoppingList = (itemId) => ({
  type: 'REMOVE_FROM_SHOPPING_LIST',
  payload: itemId
})

export const updateShoppingItem = (item) => ({
  type: 'UPDATE_SHOPPING_ITEM',
  payload: item
})

export const markShoppingItemBought = (itemId, bought) => ({
  type: 'MARK_SHOPPING_ITEM_BOUGHT',
  payload: { itemId, bought }
})

export const moveBoughtToPantry = () => ({
  type: 'MOVE_BOUGHT_TO_PANTRY'
})

export const setShoppingList = (shoppingList) => ({
  type: 'SET_SHOPPING_LIST',
  payload: shoppingList
})

export const setLoading = (isLoading) => ({
  type: 'SET_LOADING',
  payload: isLoading
})

export const setError = (error) => ({
  type: 'SET_ERROR',
  payload: error
})

export const setApiKeyStatus = (hasKey) => ({
  type: 'SET_API_KEY_STATUS',
  payload: hasKey
})

export const setDemoDataBanner = (show) => ({
  type: 'SET_DEMO_DATA_BANNER',
  payload: show
})

export const setFilter = (filterType, value) => ({
  type: 'SET_FILTER',
  payload: { filterType, value }
})

export const resetFilters = () => ({
  type: 'RESET_FILTERS'
})

export const setRecipes = (recipes) => ({
  type: 'SET_RECIPES',
  payload: recipes
})

export const setCurrentRecipe = (recipe) => ({
  type: 'SET_CURRENT_RECIPE',
  payload: recipe
})

export const showSnackbar = (message, actionText = null, onActionPress = null) => ({
  type: 'SHOW_SNACKBAR',
  payload: { message, actionText, onActionPress }
})

export const hideSnackbar = () => ({
  type: 'HIDE_SNACKBAR'
})

const AppContext = createContext()

export const StoreProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState)
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const [pantry, favorites, shoppingList] = await Promise.all([
          load('pantry', []),
          load('favorites', []),
          load('shoppingList', [])
        ])
        dispatch(setPantry(pantry))
        dispatch(setFavorites(favorites))
        dispatch(setShoppingList(shoppingList))
        const apiKeyAvailable = hasKey()
        dispatch(setApiKeyStatus(apiKeyAvailable))
        dispatch(setDemoDataBanner(!apiKeyAvailable))
      } catch (error) {
        // Error loading data
      }
    }
    loadSavedData()
  }, [])

  useEffect(() => {
    save('pantry', state.pantry.items)
  }, [state.pantry])

  useEffect(() => {
    save('favorites', state.favorites)
  }, [state.favorites])

  useEffect(() => {
    save('shoppingList', state.shoppingList)
  }, [state.shoppingList])

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export const useStore = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider')
  }
  return context
}

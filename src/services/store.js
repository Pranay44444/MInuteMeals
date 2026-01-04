import React, { createContext, useContext, useReducer, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { hasKey } from '../utils/env'
import { checkRecipeMatch, makePantrySet } from './recipes'

const defaultState = {
    pantry: { items: [], lastUpdated: null },
    favorites: [],
    shoppingList: [],
    recipes: [],
    currentRecipe: null,
    generatedRecipes: [],
    recipesLoading: false,
    recipesError: null,
    hasMoreRecipes: true,
    currentPage: 0,
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
        showDemoDataBanner: true,
        isInitialSyncComplete: false
    },
    snackbar: {
        visible: false,
        message: '',
        actionText: null,
        onActionPress: null
    }
}

const save = async (key, data) => {
    try { await AsyncStorage.setItem(key, JSON.stringify(data)) } catch (e) { }
}

const load = async (key, fallback = []) => {
    try {
        const data = await AsyncStorage.getItem(key)
        return data ? JSON.parse(data) : fallback
    } catch (e) { return fallback }
}

export const mergeItems = (items) => {
    const merged = {}
    items.forEach(item => {
        if (!item || !item.name) return
        const key = item.name.toLowerCase().trim()
        if (merged[key]) {
            const old = merged[key]
            const oldTime = old.lastUpdated || 0
            const newTime = item.lastUpdated || 0
            if (newTime > oldTime) merged[key] = { ...item }
            else if (newTime === oldTime && item.qty && !old.qty) merged[key] = { ...item }
        } else {
            merged[key] = { ...item }
        }
    })
    return Object.values(merged)
}

export const mergeStringArrays = (items) => {
    const seen = new Set()
    const result = []
    items.forEach(item => {
        if (!item) return
        const norm = String(item).toLowerCase().trim()
        if (norm && !seen.has(norm)) {
            seen.add(norm)
            result.push(norm)
        }
    })
    return result
}

const updateMatches = (state, pantryItems) => {
    if (!state.generatedRecipes || state.generatedRecipes.length === 0) return state.generatedRecipes
    const pantrySet = makePantrySet(pantryItems)
    return state.generatedRecipes.map(item => {
        const recipe = item.recipe || item
        const match = checkRecipeMatch(recipe, pantrySet)
        return { ...recipe, match }
    })
}

const reducer = (state, action) => {
    switch (action.type) {
        case 'ADD_TO_PANTRY':
            if (state.pantry.items.includes(action.payload)) return state
            const addItems = [...state.pantry.items, action.payload]
            return { ...state, pantry: { items: addItems, lastUpdated: Date.now() }, generatedRecipes: updateMatches(state, addItems) }

        case 'REMOVE_FROM_PANTRY':
            const remItems = state.pantry.items.filter(i => i !== action.payload)
            return { ...state, pantry: { items: remItems, lastUpdated: Date.now() }, generatedRecipes: updateMatches(state, remItems) }

        case 'SET_PANTRY':
            const raw = Array.isArray(action.payload) ? action.payload : action.payload.items || []
            const setItems = raw.map(i => {
                if (i && typeof i === 'object' && i.name) return String(i.name).trim().toLowerCase()
                return String(i).trim().toLowerCase()
            }).filter(Boolean)
            return { ...state, pantry: { items: setItems, lastUpdated: Date.now() }, generatedRecipes: updateMatches(state, setItems) }

        case 'ADD_TO_FAVORITES':
            if (state.favorites.some(r => r.id === action.payload.id)) return state
            return { ...state, favorites: [...state.favorites, action.payload] }

        case 'REMOVE_FROM_FAVORITES':
            return { ...state, favorites: state.favorites.filter(r => r.id !== action.payload) }

        case 'SET_FAVORITES':
            return { ...state, favorites: action.payload }

        case 'ADD_TO_SHOPPING_LIST':
            return { ...state, shoppingList: mergeItems([...state.shoppingList, ...action.payload]) }

        case 'REMOVE_FROM_SHOPPING_LIST':
            return { ...state, shoppingList: state.shoppingList.filter(i => i.id !== action.payload) }

        case 'UPDATE_SHOPPING_ITEM':
            return { ...state, shoppingList: state.shoppingList.map(i => i.id === action.payload.id ? { ...i, ...action.payload } : i) }

        case 'MARK_SHOPPING_ITEM_BOUGHT':
            return { ...state, shoppingList: state.shoppingList.map(i => i.id === action.payload.itemId ? { ...i, bought: action.payload.bought } : i) }

        case 'MOVE_BOUGHT_TO_PANTRY':
            const bought = state.shoppingList.filter(i => i.bought)
            const newPantry = bought.map(i => i.name)
            const remaining = state.shoppingList.filter(i => !i.bought)
            const combined = [...new Set([...state.pantry.items, ...newPantry])]
            return { ...state, pantry: { items: combined, lastUpdated: Date.now() }, shoppingList: remaining, generatedRecipes: updateMatches(state, combined) }

        case 'SET_SHOPPING_LIST':
            return { ...state, shoppingList: action.payload }

        case 'SET_LOADING':
            return { ...state, ui: { ...state.ui, isLoading: action.payload } }

        case 'SET_ERROR':
            return { ...state, ui: { ...state.ui, error: action.payload } }

        case 'SET_API_KEY_STATUS':
            return { ...state, ui: { ...state.ui, hasKey: action.payload } }

        case 'SET_DEMO_DATA_BANNER':
            return { ...state, ui: { ...state.ui, showDemoDataBanner: action.payload } }

        case 'SET_INITIAL_SYNC_COMPLETE':
            return { ...state, ui: { ...state.ui, isInitialSyncComplete: action.payload } }

        case 'SET_FILTER':
            return { ...state, filters: { ...state.filters, [action.payload.filterType]: action.payload.value } }

        case 'RESET_FILTERS':
            return { ...state, filters: defaultState.filters }

        case 'SET_RECIPES':
            return { ...state, recipes: action.payload }

        case 'SET_CURRENT_RECIPE':
            return { ...state, currentRecipe: action.payload }

        case 'SHOW_SNACKBAR':
            return { ...state, snackbar: { visible: true, message: action.payload.message, actionText: action.payload.actionText, onActionPress: action.payload.onActionPress } }

        case 'HIDE_SNACKBAR':
            return { ...state, snackbar: { ...state.snackbar, visible: false } }

        case 'SET_GENERATED_RECIPES':
            return { ...state, generatedRecipes: action.payload, recipesError: null }

        case 'APPEND_GENERATED_RECIPES':
            return { ...state, generatedRecipes: [...state.generatedRecipes, ...action.payload], recipesError: null }

        case 'UPDATE_GENERATED_RECIPE':
            return { ...state, generatedRecipes: state.generatedRecipes.map(r => r.id === action.payload.id ? action.payload : r) }

        case 'SET_RECIPES_LOADING':
            return { ...state, recipesLoading: action.payload }

        case 'SET_RECIPES_ERROR':
            return { ...state, recipesError: action.payload, recipesLoading: false }

        case 'SET_HAS_MORE_RECIPES':
            return { ...state, hasMoreRecipes: action.payload }

        case 'INCREMENT_RECIPE_PAGE':
            return { ...state, currentPage: state.currentPage + 1 }

        case 'RESET_RECIPE_STATE':
            return { ...state, generatedRecipes: [], recipesLoading: false, recipesError: null, hasMoreRecipes: true, currentPage: 0 }

        default:
            return state
    }
}

export const addToPantry = (item) => ({ type: 'ADD_TO_PANTRY', payload: item })
export const removeFromPantry = (item) => ({ type: 'REMOVE_FROM_PANTRY', payload: item })
export const setPantry = (pantry) => ({ type: 'SET_PANTRY', payload: pantry })
export const addToFavorites = (recipe) => ({ type: 'ADD_TO_FAVORITES', payload: recipe })
export const removeFromFavorites = (id) => ({ type: 'REMOVE_FROM_FAVORITES', payload: id })
export const setFavorites = (favs) => ({ type: 'SET_FAVORITES', payload: favs })
export const addToShoppingList = (items) => ({ type: 'ADD_TO_SHOPPING_LIST', payload: Array.isArray(items) ? items : [items] })
export const removeFromShoppingList = (id) => ({ type: 'REMOVE_FROM_SHOPPING_LIST', payload: id })
export const updateShoppingItem = (item) => ({ type: 'UPDATE_SHOPPING_ITEM', payload: item })
export const markShoppingItemBought = (id, bought) => ({ type: 'MARK_SHOPPING_ITEM_BOUGHT', payload: { itemId: id, bought } })
export const moveBoughtToPantry = () => ({ type: 'MOVE_BOUGHT_TO_PANTRY' })
export const setShoppingList = (list) => ({ type: 'SET_SHOPPING_LIST', payload: list })
export const setLoading = (val) => ({ type: 'SET_LOADING', payload: val })
export const setError = (err) => ({ type: 'SET_ERROR', payload: err })
export const setApiKeyStatus = (has) => ({ type: 'SET_API_KEY_STATUS', payload: has })
export const setDemoDataBanner = (show) => ({ type: 'SET_DEMO_DATA_BANNER', payload: show })
export const setInitialSyncComplete = (done) => ({ type: 'SET_INITIAL_SYNC_COMPLETE', payload: done })
export const setFilter = (type, val) => ({ type: 'SET_FILTER', payload: { filterType: type, value: val } })
export const resetFilters = () => ({ type: 'RESET_FILTERS' })
export const setRecipes = (recipes) => ({ type: 'SET_RECIPES', payload: recipes })
export const setCurrentRecipe = (recipe) => ({ type: 'SET_CURRENT_RECIPE', payload: recipe })
export const showSnackbar = (msg, actionText = null, onAction = null) => ({ type: 'SHOW_SNACKBAR', payload: { message: msg, actionText, onActionPress: onAction } })
export const hideSnackbar = () => ({ type: 'HIDE_SNACKBAR' })
export const setGeneratedRecipes = (recipes) => ({ type: 'SET_GENERATED_RECIPES', payload: recipes })
export const appendGeneratedRecipes = (recipes) => ({ type: 'APPEND_GENERATED_RECIPES', payload: recipes })
export const updateGeneratedRecipe = (recipe) => ({ type: 'UPDATE_GENERATED_RECIPE', payload: recipe })
export const setRecipesLoading = (val) => ({ type: 'SET_RECIPES_LOADING', payload: val })
export const setRecipesError = (err) => ({ type: 'SET_RECIPES_ERROR', payload: err })
export const setHasMoreRecipes = (has) => ({ type: 'SET_HAS_MORE_RECIPES', payload: has })
export const incrementRecipePage = () => ({ type: 'INCREMENT_RECIPE_PAGE' })
export const resetRecipeState = () => ({ type: 'RESET_RECIPE_STATE' })

const AppContext = createContext()

export const StoreProvider = ({ children }) => {
    const [state, dispatch] = useReducer(reducer, defaultState)

    useEffect(() => {
        const loadData = async () => {
            try {
                const [pantry, favorites, shoppingList] = await Promise.all([
                    load('pantry', []),
                    load('favorites', []),
                    load('shoppingList', [])
                ])
                const cleanFavs = favorites.filter(i => typeof i !== 'string')
                dispatch(setPantry(pantry))
                dispatch(setFavorites(cleanFavs))
                dispatch(setShoppingList(shoppingList))
                const keyAvailable = hasKey()
                dispatch(setApiKeyStatus(keyAvailable))
                dispatch(setDemoDataBanner(!keyAvailable))
            } catch (e) { }
        }
        loadData()
    }, [])

    useEffect(() => {
        const pullCloud = async () => {
            try {
                const token = await AsyncStorage.getItem('authToken')
                if (!token) {
                    dispatch(setInitialSyncComplete(true))
                    return
                }

                console.log('[Sync] Pulling cloud data...')
                const { getCloudData } = await import('./sync')
                const cloud = await getCloudData()

                if (cloud && cloud.success !== false && !cloud.error) {
                    const [localPantry, localFavs, localShopping] = await Promise.all([
                        load('pantry', []),
                        load('favorites', []),
                        load('shoppingList', [])
                    ])

                    let finalPantry = localPantry
                    let finalFavs = localFavs
                    let finalShopping = localShopping

                    const isEmpty = localPantry.length === 0 && localFavs.length === 0 && localShopping.length === 0

                    if (isEmpty) {
                        console.log('[Sync] Local empty, using cloud data')
                        if (cloud.pantry && Array.isArray(cloud.pantry)) finalPantry = cloud.pantry
                        if (cloud.favorites && Array.isArray(cloud.favorites)) finalFavs = cloud.favorites
                        if (cloud.shoppingList && Array.isArray(cloud.shoppingList)) finalShopping = cloud.shoppingList
                    } else {
                        console.log('[Sync] Merging cloud + local')
                        if (cloud.pantry && Array.isArray(cloud.pantry)) finalPantry = mergeStringArrays([...localPantry, ...cloud.pantry])
                        if (cloud.favorites && Array.isArray(cloud.favorites)) {
                            const map = {}
                                ;[...localFavs, ...cloud.favorites].forEach(f => { if (f && f.id) map[f.id] = f })
                            finalFavs = Object.values(map)
                        }
                        if (cloud.shoppingList && Array.isArray(cloud.shoppingList)) finalShopping = mergeItems([...localShopping, ...cloud.shoppingList])
                    }

                    await AsyncStorage.multiSet([
                        ['pantry', JSON.stringify(finalPantry)],
                        ['favorites', JSON.stringify(finalFavs)],
                        ['shoppingList', JSON.stringify(finalShopping)]
                    ])

                    dispatch(setPantry(finalPantry))
                    dispatch(setFavorites(finalFavs))
                    dispatch(setShoppingList(finalShopping))
                } else {
                    console.log('[Sync] No cloud data')
                }

                console.log('[Sync] Ready')
                dispatch(setInitialSyncComplete(true))
            } catch (e) {
                console.error('Sync error:', e)
                dispatch(setInitialSyncComplete(true))
            }
        }
        pullCloud()
    }, [])

    useEffect(() => { save('pantry', state.pantry.items) }, [state.pantry])
    useEffect(() => { save('favorites', state.favorites) }, [state.favorites])
    useEffect(() => { save('shoppingList', state.shoppingList) }, [state.shoppingList])

    useEffect(() => {
        const pushCloud = async () => {
            try {
                if (!state.ui.isInitialSyncComplete) return

                const user = await AsyncStorage.getItem('user')
                const token = await AsyncStorage.getItem('authToken')
                if (!user || !token) return

                const { syncToCloud } = await import('./sync')
                const timer = setTimeout(async () => {
                    console.log('[Sync] Pushing to cloud...')
                    const result = await syncToCloud(state.pantry.items, state.favorites, state.shoppingList, state.filters)
                    if (result.success) console.log('[Sync] Done')
                    else console.log('[Sync] Failed:', result.error || result.message)
                }, 2000)

                return () => clearTimeout(timer)
            } catch (e) {
                console.error('Sync error:', e)
            }
        }
        pushCloud()
    }, [state.pantry.items, state.favorites, state.shoppingList, state.filters, state.ui.isInitialSyncComplete])

    return (
        <AppContext.Provider value={{ state, dispatch }}>
            {children}
        </AppContext.Provider>
    )
}

export const useStore = () => {
    const ctx = useContext(AppContext)
    if (!ctx) throw new Error('useStore must be used within StoreProvider')
    return ctx
}

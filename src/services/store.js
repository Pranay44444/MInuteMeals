import React, { createContext, useContext, useReducer, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { hasKey } from '../utils/env'
import { checkRecipeMatch, makePantrySet } from './recipes'

const initialState = {
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
        isInitialSyncComplete: false // GATEKEEPER: Prevents pushing empty data before initial pull
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

export const mergeItems = (items) => {
    const merged = {}
    items.forEach(item => {
        if (!item || !item.name) {
            return
        }
        const key = item.name.toLowerCase().trim()

        if (merged[key]) {
            const existing = merged[key];
            const existingTime = existing.lastUpdated || 0;
            const newItemTime = item.lastUpdated || 0;

            if (newItemTime > existingTime) {
                merged[key] = { ...item };
            } else if (newItemTime < existingTime) {
                // Keep existing
            } else {
                if (item.qty && !existing.qty) {
                    merged[key] = { ...item }
                }
            }
        } else {
            merged[key] = { ...item }
        }
    })
    return Object.values(merged)
}

// Merge for PANTRY items which are plain strings (not objects)
export const mergeStringArrays = (items) => {
    const seen = new Set()
    const result = []
    items.forEach(item => {
        if (!item) return
        const normalized = String(item).toLowerCase().trim()
        if (normalized && !seen.has(normalized)) {
            seen.add(normalized)
            result.push(normalized)
        }
    })
    return result
}

const recalculateMatches = (state, newPantryItems) => {
    if (!state.generatedRecipes || state.generatedRecipes.length === 0) {
        return state.generatedRecipes
    }
    const pantrySet = makePantrySet(newPantryItems)
    return state.generatedRecipes.map(item => {
        const recipeObj = item.recipe || item
        const match = checkRecipeMatch(recipeObj, pantrySet)
        return {
            ...recipeObj,
            match: match
        }
    })
}

const reducer = (state, action) => {
    switch (action.type) {
        case 'ADD_TO_PANTRY':
            if (state.pantry.items.includes(action.payload)) {
                return state
            }
            const pItemsAdd = [...state.pantry.items, action.payload]
            return {
                ...state,
                pantry: {
                    items: pItemsAdd,
                    lastUpdated: Date.now()
                },
                generatedRecipes: recalculateMatches(state, pItemsAdd)
            }
        case 'REMOVE_FROM_PANTRY':
            const pItemsRem = state.pantry.items.filter(item => item !== action.payload)
            return {
                ...state,
                pantry: {
                    items: pItemsRem,
                    lastUpdated: Date.now()
                },
                generatedRecipes: recalculateMatches(state, pItemsRem)
            }
        case 'SET_PANTRY':
            // Normalize: Ensure pantry items are always strings
            const rawPayload = Array.isArray(action.payload) ? action.payload : action.payload.items || []
            const pItemsSet = rawPayload.map(item => {
                // If it's an object with 'name', extract the name
                if (item && typeof item === 'object' && item.name) {
                    return String(item.name).trim().toLowerCase()
                }
                // If it's already a string, normalize it
                return String(item).trim().toLowerCase()
            }).filter(Boolean) // Remove empty strings
            return {
                ...state,
                pantry: {
                    items: pItemsSet,
                    lastUpdated: Date.now()
                },
                generatedRecipes: recalculateMatches(state, pItemsSet)
            }
        case 'ADD_TO_FAVORITES':
            if (state.favorites.some(r => r.id === action.payload.id)) {
                return state
            }
            return {
                ...state,
                favorites: [...state.favorites, action.payload]
            }
        case 'REMOVE_FROM_FAVORITES':
            return {
                ...state,
                favorites: state.favorites.filter(r => r.id !== action.payload)
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
            const finalPantryItems = [...new Set([...state.pantry.items, ...newPantryItems])]
            return {
                ...state,
                pantry: {
                    items: finalPantryItems,
                    lastUpdated: Date.now()
                },
                shoppingList: remainingShoppingItems,
                generatedRecipes: recalculateMatches(state, finalPantryItems)
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
        case 'SET_INITIAL_SYNC_COMPLETE':
            return {
                ...state,
                ui: { ...state.ui, isInitialSyncComplete: action.payload }
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
        case 'SET_GENERATED_RECIPES':
            return {
                ...state,
                generatedRecipes: action.payload,
                recipesError: null
            }
        case 'APPEND_GENERATED_RECIPES':
            return {
                ...state,
                generatedRecipes: [...state.generatedRecipes, ...action.payload],
                recipesError: null
            }
        case 'UPDATE_GENERATED_RECIPE':
            return {
                ...state,
                generatedRecipes: state.generatedRecipes.map(r =>
                    r.id === action.payload.id ? action.payload : r
                )
            }
        case 'SET_RECIPES_LOADING':
            return {
                ...state,
                recipesLoading: action.payload
            }
        case 'SET_RECIPES_ERROR':
            return {
                ...state,
                recipesError: action.payload,
                recipesLoading: false
            }
        case 'SET_HAS_MORE_RECIPES':
            return {
                ...state,
                hasMoreRecipes: action.payload
            }
        case 'INCREMENT_RECIPE_PAGE':
            return {
                ...state,
                currentPage: state.currentPage + 1
            }
        case 'RESET_RECIPE_STATE':
            return {
                ...state,
                generatedRecipes: [],
                recipesLoading: false,
                recipesError: null,
                hasMoreRecipes: true,
                currentPage: 0
            }
        default:
            return state
    }
}

// Action Creators
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

export const setInitialSyncComplete = (isComplete) => ({
    type: 'SET_INITIAL_SYNC_COMPLETE',
    payload: isComplete
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

export const setGeneratedRecipes = (recipes) => ({
    type: 'SET_GENERATED_RECIPES',
    payload: recipes
})

export const appendGeneratedRecipes = (recipes) => ({
    type: 'APPEND_GENERATED_RECIPES',
    payload: recipes
})

export const updateGeneratedRecipe = (recipe) => ({
    type: 'UPDATE_GENERATED_RECIPE',
    payload: recipe
})

export const setRecipesLoading = (isLoading) => ({
    type: 'SET_RECIPES_LOADING',
    payload: isLoading
})

export const setRecipesError = (error) => ({
    type: 'SET_RECIPES_ERROR',
    payload: error
})

export const setHasMoreRecipes = (hasMore) => ({
    type: 'SET_HAS_MORE_RECIPES',
    payload: hasMore
})

export const incrementRecipePage = () => ({
    type: 'INCREMENT_RECIPE_PAGE'
})

export const resetRecipeState = () => ({
    type: 'RESET_RECIPE_STATE'
})

const AppContext = createContext()

export const StoreProvider = ({ children }) => {
    const [state, dispatch] = useReducer(reducer, initialState)

    // Initial Local Load (from AsyncStorage)
    useEffect(() => {
        const loadSavedData = async () => {
            try {
                const [pantry, favorites, shoppingList] = await Promise.all([
                    load('pantry', []),
                    load('favorites', []),
                    load('shoppingList', [])
                ])

                // Clean up legacy data: remove string IDs from favorites
                const cleanFavorites = favorites.filter(item => typeof item !== 'string');

                dispatch(setPantry(pantry))
                dispatch(setFavorites(cleanFavorites))
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

    // Auto-sync ON START (Pull from Cloud first - GATEKEEPER UNLOCK)
    useEffect(() => {
        const pullCloudDataOnStart = async () => {
            try {
                const token = await AsyncStorage.getItem('authToken');
                if (!token) {
                    // Not signed in, unlock gatekeeper immediately (nothing to pull)
                    dispatch(setInitialSyncComplete(true));
                    return;
                }

                console.log('[Sync] App Start: Pulling latest cloud data...');
                const { getCloudData } = await import('./sync');
                const cloudData = await getCloudData();

                if (cloudData && cloudData.success !== false && !cloudData.error) {
                    console.log('[Sync] App Start: Cloud data received. Populating local state...');

                    // Load current local data to merge against
                    const [localPantry, localFavorites, localShopping] = await Promise.all([
                        load('pantry', []),
                        load('favorites', []),
                        load('shoppingList', [])
                    ]);

                    let finalPantry = localPantry;
                    let finalFavorites = localFavorites;
                    let finalShopping = localShopping;

                    const isLocalEmpty = localPantry.length === 0 && localFavorites.length === 0 && localShopping.length === 0;

                    if (isLocalEmpty) {
                        // RECOVERY MODE: Local is empty, adopt cloud data entirely
                        console.log('[Sync] Local is empty. Adopting Cloud Data (Recovery Mode).');
                        if (cloudData.pantry && Array.isArray(cloudData.pantry)) finalPantry = cloudData.pantry;
                        if (cloudData.favorites && Array.isArray(cloudData.favorites)) finalFavorites = cloudData.favorites;
                        if (cloudData.shoppingList && Array.isArray(cloudData.shoppingList)) finalShopping = cloudData.shoppingList;
                    } else {
                        // MERGE MODE: Both have data, merge carefully
                        console.log('[Sync] Merging cloud + local data.');
                        if (cloudData.pantry && Array.isArray(cloudData.pantry)) {
                            finalPantry = mergeStringArrays([...localPantry, ...cloudData.pantry]);
                        }
                        if (cloudData.favorites && Array.isArray(cloudData.favorites)) {
                            const distinctFavs = {};
                            [...localFavorites, ...cloudData.favorites].forEach(f => {
                                if (f && f.id) distinctFavs[f.id] = f;
                            });
                            finalFavorites = Object.values(distinctFavs);
                        }
                        if (cloudData.shoppingList && Array.isArray(cloudData.shoppingList)) {
                            finalShopping = mergeItems([...localShopping, ...cloudData.shoppingList]);
                        }
                    }

                    // Persist to AsyncStorage
                    await AsyncStorage.multiSet([
                        ['pantry', JSON.stringify(finalPantry)],
                        ['favorites', JSON.stringify(finalFavorites)],
                        ['shoppingList', JSON.stringify(finalShopping)]
                    ]);

                    // Update UI
                    dispatch(setPantry(finalPantry));
                    dispatch(setFavorites(finalFavorites));
                    dispatch(setShoppingList(finalShopping));
                } else {
                    console.log('[Sync] No cloud data or error. Using local state only.');
                }

                // UNLOCK GATEKEEPER
                console.log('[Sync] Gatekeeper Unlocked (App Start).');
                dispatch(setInitialSyncComplete(true));

            } catch (error) {
                console.error('App Start Sync Error:', error);
                // Even on error, unlock gatekeeper to allow offline usage
                dispatch(setInitialSyncComplete(true));
            }
        };

        pullCloudDataOnStart();
    }, [])

    // Save to AsyncStorage on change
    useEffect(() => {
        save('pantry', state.pantry.items)
    }, [state.pantry])

    useEffect(() => {
        save('favorites', state.favorites)
    }, [state.favorites])

    useEffect(() => {
        save('shoppingList', state.shoppingList)
    }, [state.shoppingList])

    // Auto-sync to cloud when data changes (if signed in AND gatekeeper unlocked)
    useEffect(() => {
        const syncToCloudIfSignedIn = async () => {
            try {
                // GATEKEEPER CHECK: Do NOT push until initial sync is complete
                if (!state.ui.isInitialSyncComplete) {
                    console.log('[Sync] Auto-sync blocked: Initial sync not complete.');
                    return;
                }

                // Check if user is signed in
                const userJson = await AsyncStorage.getItem('user');
                const token = await AsyncStorage.getItem('authToken');

                if (!userJson || !token) {
                    return; // Not signed in, skip cloud sync
                }

                // Import sync service dynamically to avoid circular dependency
                const { syncToCloud } = await import('./sync');

                // Sync to cloud with debounce (wait 2 seconds after last change)
                const syncTimeout = setTimeout(async () => {
                    console.log('[Sync] Auto-syncing to cloud...');
                    const result = await syncToCloud(
                        state.pantry.items,
                        state.favorites,
                        state.shoppingList,
                        state.filters
                    );
                    if (result.success) {
                        console.log('[Sync] Auto-sync successful');
                    } else {
                        console.log('[Sync] Auto-sync failed:', result.error || result.message || 'Unknown error');
                    }
                }, 2000);

                return () => clearTimeout(syncTimeout);
            } catch (error) {
                console.error('Auto-sync error:', error);
            }
        };

        syncToCloudIfSignedIn();
    }, [state.pantry.items, state.favorites, state.shoppingList, state.filters, state.ui.isInitialSyncComplete]);

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

import {hasKey} from '../utils/env'

const mockRecipes = [
  {
    id: '1',
    title: 'Quick Pasta with Garlic',
    image: null,
    timeMinutes: 15,
    isVeg: true,
    cuisine: 'Italian',
    difficulty: 'easy',
    ingredients: [
      {name: 'pasta',qty: '200',unit: 'g',required: true},
      {name: 'garlic',qty: '3',unit: 'cloves',required: true},
      {name: 'olive oil',qty: '2',unit: 'tbsp',required: true},
      {name: 'parmesan cheese',qty: '50',unit: 'g',required: false}
    ],
    steps: [
      'Boil water in a large pot and cook pasta according to package instructions.',
      'Heat olive oil in a pan and sauté minced garlic until fragrant.',
      'Drain pasta and toss with garlic oil.',
      'Serve with grated parmesan cheese if desired.'
    ]
  },
  {
    id: '2',
    title: 'Chicken Stir Fry',
    image: null,
    timeMinutes: 20,
    isVeg: false,
    cuisine: 'Asian',
    difficulty: 'easy',
    ingredients: [
      {name: 'chicken breast',qty: '300',unit: 'g',required: true},
      {name: 'mixed vegetables',qty: '200',unit: 'g',required: true},
      {name: 'soy sauce',qty: '2',unit: 'tbsp',required: true},
      {name: 'ginger',qty: '1',unit: 'tsp',required: false}
    ],
    steps: [
      'Cut chicken into bite-sized pieces.',
      'Heat oil in a wok or large pan.',
      'Cook chicken until golden brown.',
      'Add vegetables and stir-fry for 3-4 minutes.',
      'Add soy sauce and ginger, cook for 1 more minute.'
    ]
  },
  {
    id: '3',
    title: 'Vegetable Soup',
    image: null,
    timeMinutes: 30,
    isVeg: true,
    cuisine: 'International',
    difficulty: 'easy',
    ingredients: [
      {name: 'mixed vegetables',qty: '400',unit: 'g',required: true},
      {name: 'vegetable broth',qty: '1',unit: 'liter',required: true},
      {name: 'onion',qty: '1',unit: 'piece',required: true},
      {name: 'herbs',qty: '1',unit: 'tsp',required: false}
    ],
    steps: [
      'Chop all vegetables into small pieces.',
      'Sauté onion until translucent.',
      'Add other vegetables and cook for 5 minutes.',
      'Pour in broth and simmer for 20 minutes.',
      'Season with herbs and serve hot.'
    ]
  },
  {
    id: '4',
    title: 'Chicken Pasta with Tomato',
    image: null,
    timeMinutes: 25,
    isVeg: false,
    cuisine: 'Italian',
    difficulty: 'easy',
    ingredients: [
      {name: 'pasta',qty: '300',unit: 'g',required: true},
      {name: 'chicken breast',qty: '250',unit: 'g',required: true},
      {name: 'tomato',qty: '2',unit: 'pieces',required: true},
      {name: 'onion',qty: '1',unit: 'piece',required: true},
      {name: 'olive oil',qty: '2',unit: 'tbsp',required: true}
    ],
    steps: [
      'Cook pasta according to package instructions.',
      'Cut chicken into small pieces and cook in olive oil.',
      'Add diced onion and tomato to the pan.',
      'Cook until vegetables are soft.',
      'Mix with cooked pasta and serve.'
    ]
  },
  {
    id: '5',
    title: 'Simple Tomato Pasta',
    image: null,
    timeMinutes: 15,
    isVeg: true,
    cuisine: 'Italian',
    difficulty: 'easy',
    ingredients: [
      {name: 'pasta',qty: '250',unit: 'g',required: true},
      {name: 'tomato',qty: '3',unit: 'pieces',required: true},
      {name: 'onion',qty: '1',unit: 'piece',required: true},
      {name: 'garlic',qty: '2',unit: 'cloves',required: true}
    ],
    steps: [
      'Cook pasta according to package instructions.',
      'Sauté onion and garlic until fragrant.',
      'Add diced tomatoes and cook until soft.',
      'Mix with pasta and serve.'
    ]
  }
]

const cleanName = (name) => {
  if (!name || typeof name !== 'string'){
    return ''
  }
  return name
    .replace(/<[^>]*>/g,'')
    .replace(/[<>&"']/g,'')
    .replace(/[^\w\s\-\.,']/g,'')
    .trim()
    .substring(0,100)
}

export const normalizeIngredient = (name)=>{
  const cleaned = cleanName(name)
  if (!cleaned){
    return ''
  }
  return cleaned
    .toLowerCase()
    .trim()
    .replace(/^(fresh|dried|chopped|sliced|diced|minced|ground|whole|organic)\s+/g,'')
    .replace(/\s+(fresh|dried|chopped|sliced|diced|minced|ground|whole|organic)$/g,'')
    .replace(/^\d+(\.\d+)?\s*(cups?|tbsp|tsp|oz|lbs?|g|kg|ml|l)\s+/g,'')
    .replace(/\s*\([^)]*\)/g,'')
    .replace(/\s+/g,' ')
    .trim()
}

export const makePantrySet = (items)=>{
  return new Set(items.map(normalizeIngredient))
}

const basicItems = new Set([
  'salt','water','oil','pepper','sugar','black pepper','olive oil',
  'vegetable oil','sea salt','table salt','white sugar','brown sugar'
])

const isBasic = (name)=>{
  const normal = normalizeIngredient(name)
  return basicItems.has(normal) || 
         Array.from(basicItems).some(basic => normal.includes(basic))
}

export const checkRecipeMatch = (recipe,pantrySet)=>{
  if (!recipe.ingredients || !Array.isArray(recipe.ingredients)){
    return { 
      cookNow: false, 
      missingCount: 0, 
      matchPercentage: 0, 
      missingIngredients: [],
      matchedIngredients: []
    }
  }
  const needed = recipe.ingredients.filter(ing=> ing.required !== false)
  const missing = []
  const matched = []
  let haveCount = 0
  needed.forEach((item)=> {
    const normal = normalizeIngredient(item.name)
    if (isBasic(item.name)) {
      haveCount++
      matched.push(item)
      return
    }
    const hasIt = pantrySet.has(normal) ||
      Array.from(pantrySet).some(pantryItem => 
        pantryItem.includes(normal) || normal.includes(pantryItem)
      )
    if (hasIt) {
      haveCount++
      matched.push(item)
    } else {
      missing.push(item.name)
    }
  })
  const missingCount = missing.length
  const matchPercent = needed.length > 0 
    ? Math.round((haveCount / needed.length) * 100) 
    : 0
  const canCook = missingCount === 0
  return {
    cookNow: canCook,
    missingCount,
    matchedCount: haveCount,
    totalIngredients: needed.length,
    matchPercentage: matchPercent,
    missingIngredients: missing,
    matchedIngredients: matched
  }
}

export const filterRecipes = (recipes,filters) => {
  if (!recipes || !Array.isArray(recipes)) {
    return []
  }
  return recipes.filter(recipe => {
    if (filters.isVegetarian !== null && recipe.isVeg !== filters.isVegetarian){
      return false
    }
    if (filters.maxTime && recipe.timeMinutes > filters.maxTime){
      return false
    }
    if (filters.difficulty && recipe.difficulty !== filters.difficulty){
      return false
    }
    if (filters.searchQuery){
      const query = filters.searchQuery.toLowerCase()
      const titleMatch = recipe.title.toLowerCase().includes(query)
      const ingredientMatch = recipe.ingredients.some(ing=> 
        ing.name.toLowerCase().includes(query)
      )
      if (!titleMatch && !ingredientMatch){
        return false
      }
    }
    return true
  })
}

const API_URL = 'https://api.spoonacular.com/recipes'
const callAPI = async (endpoint,params = {})=>{
  const apiKey = process.env.EXPO_PUBLIC_SPOONACULAR_API_KEY
  if (!apiKey) {
    throw new Error('API key not available')
  }
  const url = new URL(`${API_URL}${endpoint}`)
  url.searchParams.append('apiKey',apiKey)
  Object.entries(params).forEach(([key,value])=>{
    if (value !== null && value !== undefined){
      url.searchParams.append(key,value)
    }
  })
  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }
  return response.json()
}

const mapRecipe = (apiRecipe)=>{
  return{
    id: apiRecipe.id.toString(),
    title: apiRecipe.title,
    image: apiRecipe.image,
    timeMinutes: apiRecipe.readyInMinutes || 30,
    isVeg: apiRecipe.vegetarian || false,
    cuisine: apiRecipe.cuisines?.[0] || 'International',
    difficulty: apiRecipe.readyInMinutes <= 20 ? 'easy' : apiRecipe.readyInMinutes <= 45 ? 'medium' : 'hard',
    ingredients: apiRecipe.extendedIngredients?.map(ing => ({
      name: ing.name,
      qty: ing.amount?.toString() || '1',
      unit: ing.unit || 'piece',
      required: true
    })) || [],
    steps: apiRecipe.analyzedInstructions?.[0]?.steps?.map(step=> step.step) || []
  }
}

export const findRecipes = async (ingredients,filters = {},options = {})=>{
  const useAPI = hasKey()
  if (!useAPI){
    const matching = mockRecipes.filter(recipe=>{
      return recipe.ingredients.some(recipeItem=>{
        const recipeNormal = normalizeIngredient(recipeItem.name)
        return ingredients.some(pantryItem=>{
          const pantryNormal = normalizeIngredient(pantryItem)
          return recipeNormal.includes(pantryNormal) || 
                 pantryNormal.includes(recipeNormal)
        })
      })
    })
    const filtered = filterRecipes(matching,filters)
    return {
      recipes: filtered,
      totalResults: filtered.length
    }
  }
  try{
    const ingredientList = ingredients.join(',')
    const params = {
      ingredients: ingredientList,
      number: options.limit || 20,
      ranking: 1,
      ignorePantry: true
    }
    const data = await callAPI('/findByIngredients',params)
    const recipeIds = data.map(recipe => recipe.id).join(',')
    const detailsData = await callAPI('/informationBulk',{
      ids: recipeIds,
      includeNutrition: false
    })
    const recipes = detailsData.map(mapRecipe)
    const filtered = filterRecipes(recipes,filters)
    return {
      recipes: filtered,
      totalResults: filtered.length
    }
  }
  catch(error){
    const matching = mockRecipes.filter(recipe=>{
      return recipe.ingredients.some(recipeItem=>{
        const recipeNormal = normalizeIngredient(recipeItem.name)
        return ingredients.some(pantryItem=>{
          const pantryNormal = normalizeIngredient(pantryItem)
          return recipeNormal.includes(pantryNormal) || 
                 pantryNormal.includes(recipeNormal)
        })
      })
    })
    const filtered = filterRecipes(matching,filters)
    return {
      recipes: filtered,
      totalResults: filtered.length
    }
  }
}

export const getSimpleRecipes = async (filters = {},options = {})=>{
  const useAPI = hasKey()
  if (!useAPI){
    const simple = mockRecipes.filter(recipe=> recipe.timeMinutes <= 30)
    const filtered = filterRecipes(simple,filters)
    return {
      recipes: filtered,
      totalResults: filtered.length
    }
  }
  try{
    const params = {
      number: options.limit || 20,
      maxReadyTime: 30,
      sort: 'popularity',
      type: 'main course'
    }
    const data = await callAPI('/complexSearch',params)
    const recipeIds = data.results.map(recipe=> recipe.id).join(',')
    if (!recipeIds){
      const filtered = filterRecipes(mockRecipes,filters)
      return {
        recipes: filtered,
        totalResults: filtered.length
      }
    }
    const detailsData = await callAPI('/informationBulk',{
      ids: recipeIds,
      includeNutrition: false
    })
    const recipes = detailsData.map(mapRecipe)
    const filtered = filterRecipes(recipes,filters)
    return {
      recipes: filtered,
      totalResults: filtered.length
    }
  } 
  catch(error){
    const filtered = filterRecipes(mockRecipes,filters)
    return {
      recipes: filtered,
      totalResults: filtered.length
    }
  }
}

export const getRecipe = async (id)=>{
  const useAPI = hasKey()
  if (!useAPI){
    return mockRecipes.find(recipe=> recipe.id === id) || null
  }
  try{
    const data = await callAPI(`/${id}/information`,{
      includeNutrition: false
    })
    return mapRecipe(data)
  } 
  catch(error){
    return mockRecipes.find(recipe=> recipe.id === id) || null
  }
}

export const processRecipes = (recipes,pantryItems)=>{
  if (!recipes || !Array.isArray(recipes)){
    return []
  }
  const pantrySet = makePantrySet(pantryItems)
  return recipes.map(recipe=>({
    recipe,
    match: checkRecipeMatch(recipe,pantrySet)
  }))
}

export const getFilters = (recipes)=>{
  if (!recipes || !Array.isArray(recipes)){
    return {cuisines:[],difficulties:[],maxTimes:[15,30,45,60,90]}
  }
  const cuisines = [...new Set(recipes.map(r=> r.cuisine).filter(Boolean))]
  const difficulties = [...new Set(recipes.map(r=> r.difficulty).filter(Boolean))]
  const maxTimes = [15,30,45,60,90]
  return{
    cuisines: cuisines.sort(),
    difficulties: difficulties.sort(),
    maxTimes
  }
}

const makeItemId = (name,unit)=>{
  const normal = normalizeIngredient(name)
  return `${normal}_${unit || 'unit'}`
}

export const makeShoppingItems = (ingredients,recipeTitle = '')=>{
  return ingredients.map(item=>({
    id: makeItemId(item.name,item.unit),
    name: item.name,
    qty: item.qty || '',
    unit: item.unit || '',
    required: item.required !== false,
    bought: false,
    source: recipeTitle
  }))
}

export const getMissingForShopping = (recipeMatch,recipeTitle = '')=>{
  if (!recipeMatch.missingIngredients){
    return []
  }
  const missingItems = recipeMatch.missingIngredients.map((name)=>({
    name: name,
    qty: '',
    unit: '',
    required: true
  }))
  const nonBasic = missingItems.filter(
    item=> !isBasic(item.name)
  )
  return makeShoppingItems(nonBasic,recipeTitle)
}


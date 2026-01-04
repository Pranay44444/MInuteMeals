import { hasKey, getApiKey } from '../utils/env'
import { GoogleGenerativeAI } from "@google/generative-ai"

const cleanName = (name) => {
  if (!name || typeof name !== 'string') return ''
  return name
    .replace(/<[^>]*>/g, '')
    .replace(/[<>&"']/g, '')
    .replace(/[^\w\s\-\.,']/g, '')
    .trim()
    .substring(0, 100)
}

const toBool = (val) => {
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') {
    const lower = val.toLowerCase().trim()
    return lower === 'true' || lower === 'yes'
  }
  return !!val
}

const fixIngredients = (ingredients) => {
  if (!Array.isArray(ingredients)) return []
  return ingredients.map(ing => {
    const name = ing.name.toLowerCase()
    const isOptional = name.includes('optional') || name.includes('garnish') || name.includes('to taste')
    return { ...ing, required: !isOptional }
  })
}

export const normalizeIngredient = (name) => {
  const cleaned = cleanName(name)
  if (!cleaned) return ''
  return cleaned
    .toLowerCase()
    .trim()
    .replace(/^(fresh|dried|chopped|sliced|diced|minced|ground|whole|organic)\s+/g, '')
    .replace(/\s+(fresh|dried|chopped|sliced|diced|minced|ground|whole|organic)$/g, '')
    .replace(/^\d+(\.\d+)?\s*(cups?|tbsp|tsp|oz|lbs?|g|kg|ml|l)\s+/g, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export const makePantrySet = (items) => new Set(items.map(normalizeIngredient))

const basicItems = new Set([
  'salt', 'water', 'oil', 'pepper', 'sugar', 'black pepper', 'olive oil',
  'vegetable oil', 'sea salt', 'table salt', 'white sugar', 'brown sugar',
  'extra virgin olive oil', 'kosher salt', 'cooking oil', 'canola oil',
  'coarse salt', 'fine salt', 'ground black pepper', 'cracked black pepper'
])

const isBasic = (name) => basicItems.has(normalizeIngredient(name))

export const checkRecipeMatch = (recipe, pantrySet) => {
  if (!recipe.ingredients || !Array.isArray(recipe.ingredients)) {
    return { cookNow: false, missingCount: 0, matchPercentage: 0, missingIngredients: [], matchedIngredients: [] }
  }

  const required = recipe.ingredients.filter(i => i.required !== false)
  const missing = []
  const matched = []
  let have = 0

  recipe.ingredients.forEach((item) => {
    const norm = normalizeIngredient(item.name)
    let found = false

    if (isBasic(item.name)) {
      found = true
    } else {
      found = pantrySet.has(norm) || Array.from(pantrySet).some(p => p.includes(norm) || norm.includes(p))
    }

    if (found) {
      matched.push(item)
      if (item.required !== false) have++
    } else {
      if (item.required !== false) missing.push(item.name)
    }
  })

  const percent = required.length > 0 ? Math.round((have / required.length) * 100) : 0

  return {
    cookNow: missing.length === 0,
    missingCount: missing.length,
    matchedCount: have,
    totalIngredients: required.length,
    matchPercentage: percent,
    missingIngredients: missing,
    matchedIngredients: matched
  }
}

export const filterRecipes = (recipes, filters) => {
  if (!recipes || !Array.isArray(recipes)) return []
  return recipes.filter(r => {
    if (filters.isVegetarian !== undefined && filters.isVegetarian !== null && r.isVegetarian !== filters.isVegetarian) return false
    if (filters.maxTime && r.timeMinutes > filters.maxTime) return false
    if (filters.difficulty && r.difficulty !== filters.difficulty) return false
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase()
      const titleMatch = r.title.toLowerCase().includes(q)
      const ingMatch = r.ingredients.some(i => i.name.toLowerCase().includes(q))
      if (!titleMatch && !ingMatch) return false
    }
    return true
  })
}

const callGemini = async (prompt) => {
  const key = getApiKey() || process.env.GEMINI_API_KEY
  if (!key) throw new Error('API key not available')

  const ai = new GoogleGenerativeAI(key)
  const model = ai.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    generationConfig: { responseMimeType: "application/json" }
  })

  const maxRetries = 3
  let lastErr

  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await model.generateContent(prompt)
      const res = await result.response
      const text = res.text()
      try {
        return JSON.parse(text)
      } catch (e) {
        console.error("Bad JSON from Gemini:", text)
        throw new Error("Invalid JSON from Gemini")
      }
    } catch (err) {
      lastErr = err
      const busy = err.message?.includes('503') || err.message?.includes('overloaded')
      if (busy && i < maxRetries - 1) {
        const wait = Math.pow(2, i + 1) * 1000
        console.log(`Retrying in ${wait / 1000}s...`)
        await new Promise(r => setTimeout(r, wait))
        continue
      }
      throw err
    }
  }
  throw lastErr
}

const LITE_SCHEMA = `
{
  "recipes": [
    {
      "id": "unique id",
      "title": "recipe name",
      "image": null,
      "timeMinutes": number,
      "isVegetarian": boolean,
      "cuisine": "string",
      "difficulty": "easy|medium|hard",
      "ingredients": [
        { "name": "string", "qty": "string", "unit": "string", "required": boolean }
      ]
    }
  ]
}
`

export const findRecipes = async (ingredients, filters = {}, options = {}) => {
  const canUse = hasKey() || process.env.GEMINI_API_KEY
  if (!canUse) throw new Error('Gemini API key not configured')

  try {
    const list = ingredients.join(', ')
    const limit = options.limit || 3

    let prompt = `
      Generate up to ${limit} creative recipes using: ${list}.
      Use as many provided ingredients as possible. Add common pantry items if needed.
      Include FULL ingredient list (min 5+ items for main dishes).
      
      Response must be JSON matching this schema:
      ${LITE_SCHEMA}
    `

    if (filters.isVegetarian) prompt += "\nRecipes must be vegetarian."
    if (filters.maxTime) prompt += `\nRecipes must take less than ${filters.maxTime} minutes.`
    if (filters.difficulty) prompt += `\nRecipes must be ${filters.difficulty} difficulty.`

    const data = await callGemini(prompt)

    const recipes = data.recipes.map((r, i) => ({
      ...r,
      id: r.id || `gemini_${Date.now()}_${i}`,
      image: null,
      isVegetarian: toBool(r.isVegetarian ?? r.isVeg ?? false),
      ingredients: fixIngredients(r.ingredients)
    }))

    const filtered = filterRecipes(recipes, filters)
    return { recipes: filtered, totalResults: filtered.length }
  } catch (err) {
    console.error("Gemini error:", err)
    throw err
  }
}

export const getSimpleRecipes = async (filters = {}, options = {}) => {
  const canUse = hasKey() || process.env.GEMINI_API_KEY
  if (!canUse) throw new Error('Gemini API key not configured')

  try {
    const limit = options.limit || 3
    let prompt = `
      Generate ${limit} simple, popular, quick recipes (under 30 mins).
      Response must be JSON matching this schema:
      ${LITE_SCHEMA}
    `

    if (filters.isVegetarian) prompt += "\nRecipes must be vegetarian."
    if (filters.searchQuery) prompt += `\nRecipes related to: "${filters.searchQuery}"`

    const data = await callGemini(prompt)

    const recipes = data.recipes.map((r, i) => ({
      ...r,
      id: r.id || `simple_${Date.now()}_${i}`,
      image: null,
      isVegetarian: toBool(r.isVegetarian ?? r.isVeg ?? false)
    }))

    const filtered = filterRecipes(recipes, filters)
    return { recipes: filtered, totalResults: filtered.length }
  } catch (err) {
    console.error("Gemini error:", err)
    throw err
  }
}

export const getRecipe = async (id, context = null) => {
  const canUse = hasKey() || process.env.GEMINI_API_KEY
  if (!canUse) throw new Error('Gemini API key not configured')

  try {
    let prompt

    if (context && context.ingredients) {
      const ingList = context.ingredients.map(i => `${i.qty} ${i.unit} ${i.name}`).join(', ')

      prompt = `
        Generate detailed steps for this recipe with EXACT ingredients: ${ingList}
        
        RULES:
        1. Use ONLY the ingredients listed above
        2. DO NOT add new required ingredients
        3. You may add basic pantry items (salt, pepper, oil) if needed
        
        Return JSON for a single recipe:
        {
          "id": "${id}",
          "title": "${context.title || 'Recipe'}",
          "image": null,
          "timeMinutes": number,
          "isVegetarian": boolean,
          "cuisine": "string",
          "difficulty": "string",
          "ingredients": [...],
          "steps": ["step 1", "step 2"]
        }
      `
    } else {
      prompt = `
        Generate a detailed recipe for: "${id}"
        Return JSON for a single recipe object with id, title, timeMinutes, isVegetarian, cuisine, difficulty, ingredients, steps.
      `
    }

    const data = await callGemini(prompt)

    if (context && context.ingredients) {
      data.title = context.title || data.title
      data.ingredients = context.ingredients
      data.id = context.id
    }

    data.ingredients = fixIngredients(data.ingredients)
    data.isVegetarian = toBool(data.isVegetarian ?? data.isVeg ?? false)
    return data
  } catch (err) {
    console.error("Gemini error:", err)
    throw err
  }
}

export const processRecipes = (recipes, pantryItems) => {
  if (!recipes || !Array.isArray(recipes)) return []
  const pantrySet = makePantrySet(pantryItems)
  return recipes.map(recipe => ({ recipe, match: checkRecipeMatch(recipe, pantrySet) }))
}

export const getFilters = (recipes) => {
  if (!recipes || !Array.isArray(recipes)) return { cuisines: [], difficulties: [], maxTimes: [15, 30, 45, 60, 90] }
  const cuisines = [...new Set(recipes.map(r => r.cuisine).filter(Boolean))]
  const difficulties = [...new Set(recipes.map(r => r.difficulty).filter(Boolean))]
  return { cuisines: cuisines.sort(), difficulties: difficulties.sort(), maxTimes: [15, 30, 45, 60, 90] }
}

const makeId = (name, unit) => `${normalizeIngredient(name)}_${unit || 'unit'}`

export const makeShoppingItems = (ingredients, recipeTitle = '') => {
  return ingredients.map(item => ({
    id: makeId(item.name, item.unit),
    name: item.name,
    qty: item.qty || '',
    unit: item.unit || '',
    required: item.required !== false,
    bought: false,
    source: recipeTitle
  }))
}

export const getMissingForShopping = (match, recipeTitle = '', ingredients = []) => {
  if (!match.missingIngredients) return []

  const map = {}
  ingredients.forEach(i => {
    const norm = normalizeIngredient(i.name)
    map[norm] = { qty: i.qty || '', unit: i.unit || '' }
  })

  const items = match.missingIngredients.map(name => {
    const norm = normalizeIngredient(name)
    const info = map[norm] || { qty: '', unit: '' }
    return { name, qty: info.qty, unit: info.unit, required: true }
  })

  return makeShoppingItems(items, recipeTitle)
}

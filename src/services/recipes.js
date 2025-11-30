import { hasKey, getApiKey } from '../utils/env'
import { GoogleGenerativeAI } from "@google/generative-ai";

const cleanName = (name) => {
  if (!name || typeof name !== 'string') {
    return ''
  }
  return name
    .replace(/<[^>]*>/g, '')
    .replace(/[<>&"']/g, '')
    .replace(/[^\w\s\-\.,']/g, '')
    .trim()
    .substring(0, 100)
}

export const normalizeIngredient = (name) => {
  const cleaned = cleanName(name)
  if (!cleaned) {
    return ''
  }
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

export const makePantrySet = (items) => {
  return new Set(items.map(normalizeIngredient))
}

const basicItems = new Set([
  'salt', 'water', 'oil', 'pepper', 'sugar', 'black pepper', 'olive oil',
  'vegetable oil', 'sea salt', 'table salt', 'white sugar', 'brown sugar'
])

const isBasic = (name) => {
  const normal = normalizeIngredient(name)
  return basicItems.has(normal) ||
    Array.from(basicItems).some(basic => normal.includes(basic))
}

export const checkRecipeMatch = (recipe, pantrySet) => {
  if (!recipe.ingredients || !Array.isArray(recipe.ingredients)) {
    return {
      cookNow: false,
      missingCount: 0,
      matchPercentage: 0,
      missingIngredients: [],
      matchedIngredients: []
    }
  }
  const needed = recipe.ingredients.filter(ing => ing.required !== false)
  const missing = []
  const matched = []
  let haveCount = 0
  needed.forEach((item) => {
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

export const filterRecipes = (recipes, filters) => {
  if (!recipes || !Array.isArray(recipes)) {
    return []
  }
  return recipes.filter(recipe => {
    // Fix: Check for undefined as well, or use loose inequality != null
    if (filters.isVegetarian !== undefined && filters.isVegetarian !== null && recipe.isVeg !== filters.isVegetarian) {
      return false
    }
    if (filters.maxTime && recipe.timeMinutes > filters.maxTime) {
      return false
    }
    if (filters.difficulty && recipe.difficulty !== filters.difficulty) {
      return false
    }
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      const titleMatch = recipe.title.toLowerCase().includes(query)
      const ingredientMatch = recipe.ingredients.some(ing =>
        ing.name.toLowerCase().includes(query)
      )
      if (!titleMatch && !ingredientMatch) {
        return false
      }
    }
    return true
  })
}

// --- GEMINI API INTEGRATION ---

const callGemini = async (prompt) => {
  const apiKey = getApiKey() || process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('API key not available')
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  // Using gemini-2.5-flash-lite as requested for speed and higher limits
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    generationConfig: { responseMimeType: "application/json" }
  });

  // Retry logic: try up to 3 times for server errors
  const maxRetries = 3;
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      try {
        return JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse Gemini response:", text);
        throw new Error("Invalid JSON response from Gemini");
      }
    } catch (error) {
      lastError = error;

      // Check if it's a retryable error (503 overloaded, 429 rate limit)
      const isServerBusy = error.message?.includes('503') ||
        error.message?.includes('overloaded');

      // If server is busy and not last attempt, wait and retry
      if (isServerBusy && attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
        console.log(`Server busy, retrying in ${waitTime / 1000}s... (${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      // Otherwise, throw the error
      throw error;
    }
  }

  throw lastError;
}

const LIGHT_RECIPE_SCHEMA = `
{
  "recipes": [
    {
      "id": "unique recipe identifier",
      "title": "recipe name",
      "image": null,
      "timeMinutes": number (cooking time in minutes),
      "is Vegetarian": boolean (REQUIRED - true if vegetarian, false if contains meat/fish/poultry),
      "cuisine": "string (e.g., Italian, Asian, Mexican)",
      "difficulty": "easy|medium|hard",
      "ingredients": [
        {
          "name": "ingredient name",
          "qty": "amount as string",
          "unit": "unit of measurement",
          "required": boolean
        }
      ]
    }
  ]
}
`;

const RECIPE_SCHEMA = `
{
  "recipes": [
    {
      "id": "string (unique)",
      "title": "string",
      "image": null,
      "timeMinutes": number,
      "isVeg": boolean,
      "cuisine": "string",
      "difficulty": "easy" | "medium" | "hard",
      "ingredients": [
        {
          "name": "string",
          "qty": "string",
          "unit": "string",
          "required": boolean
        }
      ],
      "steps": ["string"]
    }
  ]
}
`;

export const findRecipes = async (ingredients, filters = {}, options = {}) => {
  const useAPI = hasKey() || process.env.GEMINI_API_KEY

  if (!useAPI) {
    throw new Error('Gemini API key not configured. Please add your API key to use recipe generation.')
  }

  try {
    const ingredientList = ingredients.join(', ');
    // Optimize: Default to 3 recipes for speed (<5 seconds)
    const limit = options.limit || 3;

    let prompt = `
      Generate up to ${limit} different creative recipes using these ingredients: ${ingredientList}.
      Try to use as many of the provided ingredients as possible, but you can add common pantry items (oil, salt, spices, etc.).
      
      IMPORTANT: Generate ${limit} recipes if possible. If fewer recipes are feasible with these ingredients, return all available recipes (minimum 1, maximum ${limit}).
      
      Response must be a JSON object matching this schema:
      ${LIGHT_RECIPE_SCHEMA}
    `;

    if (filters.isVegetarian) {
      prompt += "\nEnsure all recipes are Vegetarian.";
    }
    if (filters.maxTime) {
      prompt += `\nEnsure all recipes take less than ${filters.maxTime} minutes.`;
    }
    if (filters.difficulty) {
      prompt += `\nEnsure all recipes are ${filters.difficulty} difficulty.`;
    }

    const data = await callGemini(prompt);

    // Ensure IDs are strings and unique-ish if not provided well
    const recipes = data.recipes.map((r, index) => ({
      ...r,
      id: r.id || `gemini_${Date.now()}_${index}`,
      image: null // Gemini doesn't provide images yet
    }));

    const filtered = filterRecipes(recipes, filters);
    return {
      recipes: filtered,
      totalResults: filtered.length
    }
  } catch (error) {
    console.error("Gemini API error:", error);
    throw error
  }
}

export const getSimpleRecipes = async (filters = {}, options = {}) => {
  const useAPI = hasKey() || process.env.GEMINI_API_KEY

  if (!useAPI) {
    throw new Error('Gemini API key not configured. Please add your API key to use recipe generation.')
  }

  try {
    // Optimize: Default to 3 recipes for speed
    const limit = options.limit || 3;
    let prompt = `
      Generate ${limit} simple, popular, quick recipes (under 30 mins).
      Response must be a JSON object matching this schema:
      ${LIGHT_RECIPE_SCHEMA}
    `;

    if (filters.isVegetarian) {
      prompt += "\nEnsure all recipes are Vegetarian.";
    }
    if (filters.searchQuery) {
      prompt += `\nRecipes should be related to: "${filters.searchQuery}"`;
    }

    const data = await callGemini(prompt);

    const recipes = data.recipes.map((r, index) => ({
      ...r,
      id: r.id || `gemini_simple_${Date.now()}_${index}`,
      image: null
    }));

    const filtered = filterRecipes(recipes, filters);
    return {
      recipes: filtered,
      totalResults: filtered.length
    }
  } catch (error) {
    console.error("Gemini API error (simple):", error);
    throw error
  }
}

export const getRecipe = async (id) => {
  const useAPI = hasKey() || process.env.GEMINI_API_KEY

  if (!useAPI) {
    throw new Error('Gemini API key not configured.')
  }

  try {
    // Since we don't have a database, we ask Gemini to generate the recipe details based on the ID 
    // (assuming ID might be the title or we just ask for a recipe with that specific ID/Title context if we had it).
    // However, typically `getRecipe` is called with an ID from a previous search. 
    // If we can't persist, we might need to re-generate or rely on the caller passing data.
    // BUT, for this migration, let's assume we can generate a recipe if we have a title-like ID, 
    // or just generate a "best guess" if it's a numeric ID we don't know (which shouldn't happen if we control the IDs).

    // Strategy: If ID looks like a title (or we just treat it as a request), ask for it.
    // If it's a random string, we might fail. 
    // Let's assume the ID passed here is actually the Title or a specific identifier we generated.
    // For robustness, let's ask Gemini to "retrieve or generate" a recipe with this ID/Title.

    // NOTE: In a real app without DB, passing the whole recipe object is better. 
    // But to support the interface `getRecipe(id)`:

    let prompt = `
      Generate a detailed recipe for a dish with the identifier or title: "${id}".
      If it's an ID you generated previously, try to reconstruct the recipe.
      If it's a generic request, generate a high-quality recipe matching that name/context.
      
      Return ONLY valid JSON for a SINGLE recipe object (not an array) in this format:
      {
        "id": "${id}",
        "title": "string",
        "image": null,
        "timeMinutes": number,
        "isVeg": boolean,
        "cuisine": "string",
        "difficulty": "easy" | "medium" | "hard",
        "ingredients": [
          {
            "name": "string",
            "qty": "string",
            "unit": "string",
            "required": boolean
          }
        ],
        "steps": ["string"]
      }
    `;

    const data = await callGemini(prompt);
    return data; // Expecting single object
  } catch (error) {
    console.error("Gemini API error (getRecipe):", error);
    throw error
  }
}

export const processRecipes = (recipes, pantryItems) => {
  if (!recipes || !Array.isArray(recipes)) {
    return []
  }
  const pantrySet = makePantrySet(pantryItems)
  return recipes.map(recipe => ({
    recipe,
    match: checkRecipeMatch(recipe, pantrySet)
  }))
}

export const getFilters = (recipes) => {
  if (!recipes || !Array.isArray(recipes)) {
    return { cuisines: [], difficulties: [], maxTimes: [15, 30, 45, 60, 90] }
  }
  const cuisines = [...new Set(recipes.map(r => r.cuisine).filter(Boolean))]
  const difficulties = [...new Set(recipes.map(r => r.difficulty).filter(Boolean))]
  const maxTimes = [15, 30, 45, 60, 90]
  return {
    cuisines: cuisines.sort(),
    difficulties: difficulties.sort(),
    maxTimes
  }
}

const makeItemId = (name, unit) => {
  const normal = normalizeIngredient(name)
  return `${normal}_${unit || 'unit'}`
}

export const makeShoppingItems = (ingredients, recipeTitle = '') => {
  return ingredients.map(item => ({
    id: makeItemId(item.name, item.unit),
    name: item.name,
    qty: item.qty || '',
    unit: item.unit || '',
    required: item.required !== false,
    bought: false,
    source: recipeTitle
  }))
}

export const getMissingForShopping = (recipeMatch, recipeTitle = '', recipeIngredients = []) => {
  if (!recipeMatch.missingIngredients) {
    return []
  }

  // Create a map of ingredient names to their quantity/unit from the recipe
  const ingredientMap = {}
  recipeIngredients.forEach(ing => {
    const normalizedName = normalizeIngredient(ing.name)
    ingredientMap[normalizedName] = {
      qty: ing.qty || '',
      unit: ing.unit || ''
    }
  })

  // Map missing ingredients to shopping items with quantities from recipe
  const missingItems = recipeMatch.missingIngredients.map((name) => {
    const normalizedName = normalizeIngredient(name)
    const ingredientInfo = ingredientMap[normalizedName] || { qty: '', unit: '' }

    return {
      name: name,
      qty: ingredientInfo.qty,
      unit: ingredientInfo.unit,
      required: true
    }
  })

  const nonBasic = missingItems.filter(
    item => !isBasic(item.name)
  )
  return makeShoppingItems(nonBasic, recipeTitle)
}


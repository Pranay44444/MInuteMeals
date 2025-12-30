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

const normalizeBoolean = (val) => {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const lower = val.toLowerCase().trim();
    return lower === 'true' || lower === 'yes';
  }
  return !!val;
}

const sanitizeIngredients = (ingredients) => {
  if (!Array.isArray(ingredients)) return []
  return ingredients.map(ing => {
    // Default to required=true unless explicitly optional
    // This prevents "Noodles" in "Noodle Bowl" from being optional.
    const nameLower = ing.name.toLowerCase()
    const isExplicitlyOptional =
      nameLower.includes('optional') ||
      nameLower.includes('garnish') ||
      nameLower.includes('to taste') ||
      ing.required === false;

    // However, we trust the AI *only* if it says optional AND the name confirms it.
    // If the name looks like a main item (no 'optional' kw), we FORCE required=true.
    // This overrides AI hallucinated "optional" flags on main items.
    const isActuallyOptional = nameLower.includes('optional') || nameLower.includes('garnish') || nameLower.includes('to taste')

    return {
      ...ing,
      required: !isActuallyOptional
    }
  })
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
  'vegetable oil', 'sea salt', 'table salt', 'white sugar', 'brown sugar',
  'extra virgin olive oil', 'kosher salt', 'cooking oil', 'canola oil',
  'coarse salt', 'fine salt', 'ground black pepper', 'cracked black pepper'
])

const isBasic = (name) => {
  const normal = normalizeIngredient(name)
  return basicItems.has(normal)
}

export const checkRecipeMatch = (recipe, pantrySet) => {
  // ... (unchanged)
  if (!recipe.ingredients || !Array.isArray(recipe.ingredients)) {
    return {
      cookNow: false,
      missingCount: 0,
      matchPercentage: 0,
      missingIngredients: [],
      matchedIngredients: []
    }
  }
  /* 
    FIX: Iterate ALL ingredients, not just required ones. 
    This ensures Basic items (Salt, Oil) are marked as 'Matched' (Green) even if the AI marked them as optional.
    It also allows us to show 'Green' for optional items we happen to have.
  */
  const missing = []
  const matched = []
  let haveCount = 0

  // Calculate total needed (required only) for percentage stats
  const requiredIngredients = recipe.ingredients.filter(ing => ing.required !== false)

  recipe.ingredients.forEach((item) => {
    const normal = normalizeIngredient(item.name)
    let isFound = false

    // Check 1: Is it Basic?
    if (isBasic(item.name)) {
      isFound = true
    }
    // Check 2: Is it in Pantry?
    else {
      // Robust check: Exact match or fuzzy match
      isFound = pantrySet.has(normal) ||
        Array.from(pantrySet).some(pantryItem =>
          pantryItem.includes(normal) || normal.includes(pantryItem)
        )
    }

    if (isFound) {
      matched.push(item)
      // Only increment count if it was required (to keep percentage logic consistent with 'needed')
      // OR we can just count raw items. Let's stick to counting matched required items for percentage.
      if (item.required !== false) {
        haveCount++
      }
    } else {
      // Not found
      if (item.required !== false) {
        missing.push(item.name)
      }
    }
  })

  // Recalculate stats based on Required items
  const missingCount = missing.length
  const matchPercent = requiredIngredients.length > 0
    ? Math.round((haveCount / requiredIngredients.length) * 100)
    : 0
  const canCook = missingCount === 0

  return {
    cookNow: canCook,
    missingCount,
    matchedCount: haveCount,
    totalIngredients: requiredIngredients.length,
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
    // FIX: Standardized property isVegetarian
    if (filters.isVegetarian !== undefined && filters.isVegetarian !== null && recipe.isVegetarian !== filters.isVegetarian) {
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
      "isVegetarian": boolean (REQUIRED - true if vegetarian, false if contains meat/fish/poultry),
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
      "isVegetarian": boolean,
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
      
      CRITICAL: When generating recipe summaries, you must output the FULL ingredient list (min 5+ items for main dishes). Include ALL ingredients, even common pantry items like oil, salt, pepper, water, and spices. Do not generate simplified 2-ingredient summaries. You will be penalized for omitting ingredients.
      
      IMPORTANT: Generate ${limit} recipes if possible. If fewer recipes are feasible with these ingredients, return all available recipes (minimum 1, maximum ${limit}).
      
      Response must be a JSON object matching this schema:
      ${LIGHT_RECIPE_SCHEMA}
    `;

    if (filters.isVegetarian) {
      prompt += "\\nEnsure all recipes are Vegetarian.";
    }
    if (filters.maxTime) {
      prompt += `\\nEnsure all recipes take less than ${filters.maxTime} minutes.`;
    }
    if (filters.difficulty) {
      prompt += `\\nEnsure all recipes are ${filters.difficulty} difficulty.`;
    }

    const data = await callGemini(prompt);

    // Ensure IDs are strings and unique-ish if not provided well
    const recipes = data.recipes.map((r, index) => ({
      ...r,
      id: r.id || `gemini_${Date.now()}_${index}`,
      image: null, // Gemini doesn't provide images yet
      // Standardize isVegetarian
      isVegetarian: normalizeBoolean(r.isVegetarian ?? r.isVeg ?? r['is Vegetarian'] ?? false),
      ingredients: sanitizeIngredients(r.ingredients)
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
      prompt += "\\nEnsure all recipes are Vegetarian.";
    }
    if (filters.searchQuery) {
      prompt += `\\nRecipes should be related to: "${filters.searchQuery}"`;
    }

    const data = await callGemini(prompt);

    const recipes = data.recipes.map((r, index) => ({
      ...r,
      id: r.id || `gemini_simple_${Date.now()}_${index}`,
      image: null,
      isVegetarian: normalizeBoolean(r.isVegetarian ?? r.isVeg ?? r['is Vegetarian'] ?? false), // Standardize
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

export const getRecipe = async (id, contextRecipe = null) => {
  const useAPI = hasKey() || process.env.GEMINI_API_KEY

  if (!useAPI) {
    throw new Error('Gemini API key not configured.')
  }

  try {
    let prompt;

    if (contextRecipe && contextRecipe.ingredients) {
      // STRICT CONSISTENCY MODE
      // We have the "Lite" recipe. We must NOT hallucinate new ingredients that invalidate the user's "Ready to Cook" status.
      const ingredientList = contextRecipe.ingredients.map(i => `${i.qty} ${i.unit} ${i.name}`).join(', ');

      prompt = `
        You are a consistent recipe data engine.
        I have a recipe summary with these EXACT ingredients:
        ${ingredientList}
        
        Generate the detailed steps and metadata for this recipe.
        
        CRITICAL RULES:
        1. You MUST use the exact ingredient list provided above.
        2. ABSOLUTE PROHIBITION: You CANNOT add new required ingredients (like meat, veg, dairy, canned goods) that are not listed above.
        3. If the recipe typically requires more ingredients (e.g. "Chicken Parmesan" needs cheese but you only have Chicken and Tomato), you MUST MODIFY the recipe to work with what you have (e.g. "Simple Tomato Chicken"). DO NOT Add missing ingredients.
        4. You MAY add "basic" pantry items (Salt, Pepper, Water, Oil, Sugar) ONLY if strictly necessary.
        
        Return ONLY valid JSON for a SINGLE recipe object:
        {
          "id": "${id}",
          "title": "${contextRecipe.title || 'Recipe'}",
          "image": null,
          "timeMinutes": number,
          "isVegetarian": boolean,
          "cuisine": "string",
          "difficulty": "string",
          "ingredients": [
            { "name": "string", "qty": "string", "unit": "string", "required": boolean }
             // These should match the input list closely. DO NOT hallucinate new main ingredients.
          ],
          "steps": ["string", "string"]
        }
      `;
    } else {
      // Fallback to loose generation if no context (rare for our app flow)
      prompt = `
        Generate a detailed recipe for a dish with the identifier or title: "${id}".
        Return ONLY valid JSON for a SINGLE recipe object (not an array) in this format:
        {
          "id": "${id}",
          "title": "string",
          "image": null,
          "timeMinutes": number,
          "isVegetarian": boolean,
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
    }

    const data = await callGemini(prompt);

    // FORCE CONSISTENCY:
    // If we have a context recipe, we MUST return the SAME ingredient names/types 
    // to preserve the "Cook Ready" status. 
    // The AI might subtly rename "Pasta" to "Spaghetti", breaking the match.
    // We overwrite the AI's ingredients with our source of truth.
    if (contextRecipe && contextRecipe.ingredients) {
      // We keep the AI's steps, time, etc., but force the Core Identity (Title + Ingredients)
      // to match what the user clicked on.
      data.title = contextRecipe.title || data.title;
      data.ingredients = contextRecipe.ingredients;
      data.id = contextRecipe.id; // Ensure ID matches
    }

    data.ingredients = sanitizeIngredients(data.ingredients);
    // Standardize
    data.isVegetarian = normalizeBoolean(data.isVegetarian ?? data.isVeg ?? data['is Vegetarian'] ?? false);
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

  // The checkRecipeMatch logic already puts basic items into 'matched' (assumed owned).
  // So 'missing' list only contains non-basic items. 
  // We return all of them.
  return makeShoppingItems(missingItems, recipeTitle)
}


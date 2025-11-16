/**
 * Lightweight Canonicalization Layer
 * 
 * Post-processing step that collapses fancy varietals/phrases to standard headwords.
 * Runs AFTER detection pipeline - does not modify detectors or scoring.
 * 
 * Examples:
 *   "cherry tomato" → "tomato"
 *   "russet burbank potato" → "potato"
 *   "king oyster mushroom" → "mushroom"
 *   "anchovy fish" → "fish"
 */

// ==================== STANDARD GROCERY HEADWORDS ====================
// Universal set of standard grocery nouns (no varieties)

const HEADS = new Set([
  // Proteins (meat/poultry)
  'chicken', 'egg', 'fish', 'shrimp', 'prawn', 'crab', 'lobster',
  'mutton', 'lamb', 'beef', 'pork', 'turkey', 'duck', 'salmon',
  'tuna', 'cod', 'tilapia', 'trout', 'sardine', 'anchovy',
  
  // Dairy
  'milk', 'yogurt', 'cheese', 'paneer', 'butter', 'ghee', 'cream',
  
  // Vegetables
  'tomato', 'potato', 'onion', 'garlic', 'ginger', 'carrot',
  'cabbage', 'cauliflower', 'cucumber', 'pepper', 'chili',
  'spinach', 'broccoli', 'bean', 'pea', 'corn', 'lettuce',
  'celery', 'radish', 'beetroot', 'turnip', 'eggplant',
  'zucchini', 'squash', 'pumpkin', 'asparagus', 'artichoke',
  
  // Fruits
  'banana', 'mango', 'apple', 'orange', 'lemon', 'lime',
  'grape', 'pineapple', 'papaya', 'watermelon', 'melon',
  'strawberry', 'blueberry', 'raspberry', 'cherry', 'peach',
  'pear', 'plum', 'apricot', 'kiwi', 'avocado', 'coconut',
  
  // Grains & Staples
  'rice', 'wheat', 'flour', 'bread', 'pasta', 'noodle',
  'oat', 'barley', 'quinoa', 'couscous',
  
  // Condiments & Basics
  'oil', 'salt', 'sugar', 'vinegar', 'sauce', 'honey',
  
  // Fungi
  'mushroom',
  
  // Herbs & Spices (common)
  'basil', 'cilantro', 'parsley', 'mint', 'thyme', 'oregano',
  'rosemary', 'sage', 'dill', 'cumin', 'coriander', 'turmeric',
  'cinnamon', 'cardamom', 'clove', 'nutmeg', 'paprika',
  
  // Legumes
  'lentil', 'chickpea', 'tofu', 'soybean',
  
  // Nuts
  'almond', 'cashew', 'peanut', 'walnut', 'pistachio'
])

// Generic terms to drop if a headword exists
const GENERIC_TERMS = new Set([
  'food', 'produce', 'fruit', 'vegetable', 'dairy', 'drink', 'beverage',
  'animal', 'meat', 'seafood', 'invertebrate', 'crustacean',
  'natural foods', 'whole food', 'local food', 'nutrition', 'superfood',
  'vegan nutrition', 'diet food', 'vegetarian food', 'plant', 'ingredient',
  'cuisine', 'dish', 'recipe', 'meal', 'snack', 'staple food',
  'organic', 'fresh', 'raw', 'cooked', 'fried', 'boiled', 'grilled'
])

// ==================== NORMALIZATION ====================

/**
 * Normalize a name: lowercase, trim, strip punctuation, collapse spaces
 */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, ' ')  // Replace punctuation with space
    .replace(/\s+/g, ' ')       // Collapse multiple spaces
    .trim()
}

/**
 * Singularize a word (basic rules)
 */
function singularize(word: string): string {
  // Special cases
  const special: Record<string, string> = {
    'fungi': 'fungus',
    'leaves': 'leaf',
    'potatoes': 'potato',
    'tomatoes': 'tomato',
    'mangoes': 'mango',
    'avocados': 'avocado'
  }
  
  if (special[word]) {
    return special[word]
  }
  
  // General rules
  if (word.endsWith('ies') && word.length > 4) {
    return word.slice(0, -3) + 'y'
  }
  
  if (word.endsWith('oes') && word.length > 4) {
    return word.slice(0, -2)
  }
  
  if (word.endsWith('es') && word.length > 3) {
    // Check if it's a real 'es' plural (not "cheese", "chinese")
    const base = word.slice(0, -2)
    if (word.endsWith('sses') || word.endsWith('shes') || word.endsWith('ches') || word.endsWith('xes')) {
      return base
    }
    // Try removing just 's' for words ending in 'es'
    return word.slice(0, -1)
  }
  
  if (word.endsWith('s') && word.length > 2 && !word.endsWith('ss') && !word.endsWith('us')) {
    return word.slice(0, -1)
  }
  
  return word
}

/**
 * Singularize all words in a phrase
 */
function singularizePhrase(phrase: string): string {
  return phrase.split(' ').map(singularize).join(' ')
}

// ==================== HEADWORD REDUCTION ====================

/**
 * Extract headword from a phrase (right-most head wins)
 * 
 * Examples:
 *   "cherry tomato" → "tomato"
 *   "russet burbank potato" → "potato"
 *   "king oyster mushroom" → "mushroom"
 *   "anchovy fish" → "fish"
 */
function extractHeadword(phrase: string): string | null {
  const words = phrase.split(' ')
  
  // Right-most head wins (scan from right to left)
  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i]
    if (HEADS.has(word)) {
      return word
    }
  }
  
  return null
}

/**
 * Check if a phrase is a generic term
 */
function isGeneric(phrase: string): boolean {
  return GENERIC_TERMS.has(phrase)
}

/**
 * Check if a phrase is a clean single noun (not generic, not multi-word)
 */
function isCleanSingleNoun(phrase: string): boolean {
  const words = phrase.split(' ')
  return words.length === 1 && !isGeneric(phrase)
}

// ==================== CANONICALIZATION ====================

/**
 * Canonicalize a single ingredient name
 * 
 * @param name - Raw ingredient name from detector
 * @returns Canonical headword or null if should be dropped
 */
function canonicalizeSingle(name: string): string | null {
  // Step 1: Normalize
  const normalized = normalize(name)
  
  if (!normalized) {
    return null
  }
  
  // Step 2: Singularize
  const singular = singularizePhrase(normalized)
  
  // Step 3: Check if already a head
  if (HEADS.has(singular)) {
    return singular
  }
  
  // Step 4: Extract headword (right-most wins)
  const headword = extractHeadword(singular)
  if (headword) {
    return headword
  }
  
  // Step 5: Check if generic (drop it)
  if (isGeneric(singular)) {
    return null
  }
  
  // Step 6: If clean single noun, keep as is
  if (isCleanSingleNoun(singular)) {
    return singular
  }
  
  // Step 7: Multi-word phrase with no head and not generic
  // Keep first word if it looks like a food item
  const firstWord = singular.split(' ')[0]
  if (firstWord.length >= 3 && !isGeneric(firstWord)) {
    return firstWord
  }
  
  return null
}

/**
 * Canonicalize a list of ingredient names
 * 
 * Post-processing step that:
 * 1. Normalizes each name (lowercase, trim, strip punctuation, singularize)
 * 2. Extracts standard headwords (e.g., "cherry tomato" → "tomato")
 * 3. Drops generic terms (e.g., "food", "produce")
 * 4. Deduplicates final list
 * 5. Preserves input order
 * 
 * @param names - Raw ingredient names from detector (strings or {name} objects)
 * @returns Canonicalized ingredient names
 */
export function canonicalizeIngredients(names: string[] | Array<{ name: string }>): string[] {
  // Handle both string[] and {name}[] inputs
  const nameStrings = names.map(item => 
    typeof item === 'string' ? item : item.name
  )
  
  // Canonicalize each name
  const canonicalized: string[] = []
  const seen = new Set<string>()
  
  for (const name of nameStrings) {
    const canonical = canonicalizeSingle(name)
    
    if (canonical && !seen.has(canonical)) {
      canonicalized.push(canonical)
      seen.add(canonical)
    }
  }
  
  return canonicalized
}


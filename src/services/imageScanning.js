import Constants from 'expo-constants'
import * as ImageManipulator from 'expo-image-manipulator'
// Use legacy API to avoid deprecation warning
import * as FileSystem from 'expo-file-system/legacy'

// ⚠️ SECURITY NOTE: For MVP, API calls are client-side only.
// In production, move API calls to a secure backend proxy to protect API keys.

// ==================== CONFIGURATION ====================

// Confidence thresholds (EXTREMELY LOW - last resort for proteins)
const OBJECT_CONF_MIN = 0.30  // Objects: 30%+ (EXTREMELY LOW!)
const TAG_CONF_MIN = 0.40     // Tags: 40%+ (EXTREMELY LOW!)
const OCR_MIN_LEN = 3         // Minimum OCR token length
const IOU_THRESHOLD = 0.6     // Overlap threshold for same item
const MAX_RETRIES = 2         // Auto-retry attempts with preprocessing
const MAX_INGREDIENTS = 6     // Maximum ingredients to return from a single scan

// Protein thresholds (env-configurable)
const PROTEIN_OBJ_MIN = parseFloat(
  (Constants.expoConfig?.extra?.VISION_OBJ_MIN || Constants.manifest?.extra?.VISION_OBJ_MIN || '0.78')
) || 0.78
const PROTEIN_TAG_MIN = parseFloat(
  (Constants.expoConfig?.extra?.VISION_TAG_MIN || Constants.manifest?.extra?.VISION_TAG_MIN || '0.88')
) || 0.88

const getAzureConfig = () => {
  return {
    endpoint: Constants.expoConfig?.extra?.azureVisionEndpoint ||
              Constants.manifest?.extra?.azureVisionEndpoint ||
              'https://minutemeals-vision.cognitiveservices.azure.com',
    key: Constants.expoConfig?.extra?.azureVisionKey ||
         Constants.manifest?.extra?.azureVisionKey ||
         null
  }
}

// Basic ingredients to filter out
const BASIC_ITEMS = new Set([
  'salt', 'water', 'oil', 'sugar', 'pepper', 'black pepper',
  'olive oil', 'vegetable oil', 'sea salt', 'table salt',
  'white sugar', 'brown sugar', 'ice', 'air', 'background'
])

// ==================== BLACKLIST (Generic Terms) ====================
// These are NEVER valid ingredients - always reject
const BLACKLIST_TERMS = new Set([
  // Generic food categories
  'food', 'produce', 'vegetable', 'fruit', 'plant',
  'natural foods', 'whole food', 'organic food', 'local food',
  'fresh food', 'healthy food', 'staple food', 'superfood',
  'vegan nutrition', 'vegetarian food', 'natural food', 'whole foods',
  'fresh produce', 'ingredient', 'ingredients', 'grocery', 'groceries',
  // Noise from scenes/labels
  'market', 'supermarket', 'grocery store', 'marketplace',
  // Color-only labels that cause noise
  'green',
  // Diet/health generic terms
  'diet food', 'health food',
  
  // TOO GENERIC terms (only truly useless ones)
  'animal product', 'protein', 'raw food',
  'seafood product', 'poultry product', 'dairy product',
  'organism',
  
  // Non-food items
  'indoor', 'outdoor', 'kitchen', 'table', 'plate', 'bowl', 'dish',
  'container', 'package', 'packaging', 'wrapper', 'surface', 'counter',
  'background', 'foreground', 'scene', 'image', 'photo', 'still life',
  
  // Dietary categories
  'vegan food', 'plant-based', 'gluten-free', 'dairy-free', 'nutrition',
  'organic', 'non-gmo', 'raw food', 'health food',
  
  // Generic descriptors
  'cuisine', 'dish', 'meal', 'snack', 'breakfast', 'lunch', 'dinner',
  'cooking', 'prepared', 'cooked', 'fresh', 'frozen', 'canned',
  
  // Dish names / prepared foods (not ingredients)
  'seafood boil', 'seafood platter', 'fish fry', 'fried chicken',
  'grilled chicken', 'roasted chicken', 'bbq chicken',
  'chicken curry', 'chicken soup', 'chicken salad',
  'fish and chips', 'sushi', 'sashimi', 'ceviche',

  // Generic food categories causing noise
  'dairy', 'drink', 'beverage', 'animal fat', 'anchovy food',
  'fungu', 'fungus', 'fungi',

  // Meat generics/noise
  'red meat', 'meat carving',

  // Botanical family noise (veg)
  'agaricaceae',
  // Zoological generics (seafood noise)
  'arthropod',
  
  // Botanical/scientific terms
  'root vegetable', 'tuber', 'flowering plant', 'crop',
  'annual plant', 'herbaceous', 'leaf vegetable', 'nightshade',
  'legume', 'cruciferous', 'allium', 'solanaceae',
  
  // Generic plant parts (too generic, not ingredients)
  'bulb', 'root', 'stem', 'leaf', 'seed', 'peel', 'skin',
  'flesh', 'pulp', 'core', 'stalk', 'sprout',
  
  // Too specific/scientific seafood terms (not common ingredients)
  'krill', 'plankton', 'zooplankton', 'amphipod',
  
  // Too generic/variant terms that cause duplicates
  'ullucus', 'ullucu', 'ulluco'  // Potato variants (scientific)
])

// ==================== STRICT PROTEIN PIPELINE CONFIG ====================
// Canonical allow-list for proteins (strict mapping)
const PROTEIN_ALLOW = {
  chicken: [
    'chicken','poultry','broiler','drumstick','chicken breast','thigh','rotisserie chicken',
    'whole chicken','chicken leg','chicken wing','wings','breast','chicken thigh'
  ],
  fish: [
    'fish','salmon','tuna','tilapia','mackerel','sardine','cod','trout','anchovy','anchovies'
  ],
  shrimp: [
    'shrimp','prawn','prawns','crustacean shrimp'
  ],
  // Shellfish specifics (previously missing, causing lobster → fish fallback)
  lobster: [
    'lobster','homarus','homarus americanus','homaru','norway lobster','spiny lobster'
  ],
  crab: [
    'crab','blue crab','king crab','snow crab','dungeness crab','stone crab'
  ],
  scallops: [
    'scallop','scallops','sea scallop','bay scallop'
  ],
  mussels: [
    'mussel','mussels'
  ],
  clams: [
    'clam','clams'
  ],
  oysters: [
    'oyster','oysters'
  ],
  egg: [
    'egg','eggs','chicken egg','brown eggs','white eggs','whole egg'
  ],
  mutton: [
    'mutton','goat','goat meat','lamb','lamb chop','lamb chops'
  ],
  beef: [
    'beef','steak','ground beef','tenderloin','brisket','ribeye','sirloin','veal'
  ],
  pork: [
    'pork','bacon','ham','pork chop','pork chops','pork belly'
  ]
}

// Hard blacklist for proteins (generic terms to always drop)
const PROTEIN_HARD_BLACKLIST = new Set([
  'animal','invertebrate','crustacean','protein','meat product',
  'seafood','seafood boil','food','raw food','meal','cuisine','produce'
])

const PROTEIN_CANONICAL_KEYS = Object.keys(PROTEIN_ALLOW)
const PROTEIN_SYNONYM_TO_CANON = (() => {
  const map = new Map()
  PROTEIN_CANONICAL_KEYS.forEach(canon => {
    PROTEIN_ALLOW[canon].forEach(s => map.set(s.toLowerCase(), canon))
  })
  return map
})()

// Shellfish canonical set (used for threshold relaxation and specificity)
const SHELL_CANON_SET = new Set(['shrimp','crab','lobster','scallops','mussels','clams','oysters'])

// (Reverted) No family collapsing at this stage; rely on canonicalization and dedup rules

const proteinSynonymToCanonical = (label) => {
  if (!label) return null
  const name = String(label).toLowerCase().trim()
  if (PROTEIN_HARD_BLACKLIST.has(name)) return null
  if (PROTEIN_SYNONYM_TO_CANON.has(name)) return PROTEIN_SYNONYM_TO_CANON.get(name)
  // contains check: if a label contains the head word (e.g., tomato logic)
  for (const canon of PROTEIN_CANONICAL_KEYS) {
    if (name.includes(canon)) return canon
  }
  return null
}

// ==================== SYNONYM MAP (Canonicalization) ====================
// Maps all variants/synonyms/scientific names to canonical ingredient
const SYNONYM_MAP = {
  // ===== TOMATO VARIANTS =====
  'tomato': 'tomato',
  'tomatoes': 'tomato',
  'cherry tomato': 'tomato',
  'cherry tomatoes': 'tomato',
  'plum tomato': 'tomato',
  'plum tomatoes': 'tomato',
  'roma tomato': 'tomato',
  'roma tomatoes': 'tomato',
  'grape tomato': 'tomato',
  'grape tomatoes': 'tomato',
  'bush tomato': 'tomato',
  'beefsteak tomato': 'tomato',
  'heirloom tomato': 'tomato',
  'solanum': 'tomato',
  'solanum lycopersicum': 'tomato',
  
  // ===== POTATO VARIANTS =====
  'potato': 'potato',
  'potatoes': 'potato',
  'russet potato': 'potato',
  'russet burbank potato': 'potato',
  'yukon gold potato': 'potato',
  'gold potato': 'potato',
  'red potato': 'potato',
  'white potato': 'potato',
  'idaho potato': 'potato',
  'fingerling potato': 'potato',
  'new potato': 'potato',
  'baby potato': 'potato',
  'sweet potato': 'sweet potato',
  'yam': 'sweet potato',
  'yams': 'sweet potato',
  
  // ===== ONION VARIANTS =====
  'onion': 'onion',
  'onions': 'onion',
  'red onion': 'onion',
  'white onion': 'onion',
  'yellow onion': 'onion',
  'sweet onion': 'onion',
  'vidalia onion': 'onion',
  'spring onion': 'green onion',
  'scallion': 'green onion',
  'green onion': 'green onion',
  'shallot': 'onion',  // Shallots are onion variants
  'shallots': 'onion',
  
  // ===== PEPPER VARIANTS =====
  'pepper': 'bell pepper',
  'bell pepper': 'bell pepper',
  'bell peppers': 'bell pepper',
  'capsicum': 'bell pepper',
  'red pepper': 'bell pepper',
  'green pepper': 'bell pepper',
  'chili': 'chili',
  'chilli': 'chili',
  'chilies': 'chili',
  'chillies': 'chili',
  'jalapeño': 'chili',
  'jalapeno': 'chili',
  
  // ===== CARROT VARIANTS =====
  'carrot': 'carrot',
  'carrots': 'carrot',
  'baby carrot': 'carrot',
  
  // ===== MUSHROOM VARIANTS =====
  'mushroom': 'mushroom',
  'mushrooms': 'mushroom',
  'button mushroom': 'mushroom',
  'portobello': 'mushroom',
  'shiitake': 'mushroom',
  
  // ===== CHICKEN VARIANTS (Comprehensive + Fallbacks) =====
  'chicken': 'chicken',
  'raw chicken': 'chicken',
  'whole chicken': 'chicken',
  'chicken breast': 'chicken',
  'chicken thigh': 'chicken',
  'chicken leg': 'chicken',
  'chicken wing': 'chicken',
  'chicken wings': 'chicken',
  'chicken drumstick': 'chicken',
  'drumstick': 'chicken',
  'drumsticks': 'chicken',
  'broiler': 'chicken',
  'broiler chicken': 'chicken',
  'poultry': 'chicken',  // KEY: Azure often returns "poultry" for chicken
  'fowl': 'chicken',
  'hen': 'chicken',
  'rooster': 'chicken',
  'capon': 'chicken',
  'bird': 'chicken',  // FALLBACK: bird → chicken
  'meat': 'chicken',  // FALLBACK: meat → chicken (most common)
  'meat product': 'chicken',  // FALLBACK: meat product → chicken
  'animal': 'chicken',  // EXTREME FALLBACK: animal → chicken
  'vertebrate': 'chicken',  // EXTREME FALLBACK: vertebrate → chicken
  
  // ===== BEEF VARIANTS =====
  'beef': 'beef',
  'raw beef': 'beef',
  'ground beef': 'beef',
  'minced beef': 'beef',
  'beef steak': 'beef',
  'steak': 'beef',
  'ribeye': 'beef',
  'sirloin': 'beef',
  'chuck': 'beef',
  'brisket': 'beef',
  'tenderloin': 'beef',
  
  // ===== PORK VARIANTS =====
  'pork': 'pork',
  'raw pork': 'pork',
  'pork chop': 'pork',
  'pork chops': 'pork',
  'bacon': 'bacon',
  'ham': 'ham',
  'pork belly': 'pork',
  'sausage': 'sausage',
  'sausages': 'sausage',
  
  // ===== LAMB/MUTTON/GOAT VARIANTS =====
  'lamb': 'lamb',
  'mutton': 'mutton',
  'goat': 'mutton',  // Map goat to mutton (similar usage)
  'goat meat': 'mutton',
  'lamb chop': 'lamb',
  'lamb chops': 'lamb',
  
  // ===== TURKEY VARIANTS =====
  'turkey': 'turkey',
  'turkey breast': 'turkey',
  'ground turkey': 'turkey',
  
  // ===== DUCK VARIANTS =====
  'duck': 'duck',
  'duck breast': 'duck',
  
  // ===== FISH VARIANTS (Comprehensive) =====
  'fish': 'fish',
  'raw fish': 'fish',
  'salmon': 'salmon',
  'raw salmon': 'salmon',
  'salmon fillet': 'salmon',
  'tuna': 'tuna',
  'cod': 'cod',
  'tilapia': 'tilapia',
  'mackerel': 'mackerel',
  'trout': 'trout',
  'halibut': 'halibut',
  'catfish': 'catfish',
  
  // ===== SHELLFISH/CRUSTACEAN VARIANTS (KEY for Azure + Fallbacks) =====
  'shrimp': 'shrimp',
  'raw shrimp': 'shrimp',
  'prawns': 'shrimp',
  'prawn': 'shrimp',
  'crustacean': 'shrimp',  // KEY: Azure returns "crustacean" for shrimp
  'crustacean shrimp': 'shrimp',
  'seafood': 'fish',  // FALLBACK: If only "seafood", assume fish (more general)
  'invertebrate': 'shrimp',  // EXTREME FALLBACK: invertebrate → shrimp
  'crab': 'crab',
  'blue crab': 'crab',
  'king crab': 'crab',
  'snow crab': 'crab',
  'dungeness crab': 'crab',
  'lobster': 'lobster',
  'homarus': 'lobster',
  'homaru': 'lobster',
  'homarus americanus': 'lobster',
  'norway lobster': 'lobster',
  'spiny lobster': 'lobster',
  'scallops': 'scallops',
  'scallop': 'scallops',
  'mussels': 'mussels',
  'clams': 'clams',
  'oysters': 'oysters',
  
  // ===== DAIRY VARIANTS =====
  'milk': 'milk',
  'whole milk': 'milk',
  'skim milk': 'milk',
  '2% milk': 'milk',
  'butter': 'butter',
  'salted butter': 'butter',
  'unsalted butter': 'butter',
  'amul butter': 'butter',
  'cheese': 'cheese',
  'cheddar': 'cheese',
  'mozzarella': 'cheese',
  'paneer': 'paneer',
  'cream': 'cream',
  'yogurt': 'yogurt',
  'yoghurt': 'yogurt',
  
  // ===== EGG VARIANTS =====
  'egg': 'egg',
  'eggs': 'egg',
  'whole egg': 'egg',
  'chicken egg': 'egg',
  
  // ===== BEAN VARIANTS =====
  'beans': 'beans',
  'green beans': 'beans',
  'kidney beans': 'kidney bean',
  'black beans': 'black bean',
  'chickpeas': 'chickpea',
  'chickpea': 'chickpea',
  'garbanzo': 'chickpea',
  'lentils': 'lentils',
  'lentil': 'lentils',
  
  // ===== HERBS =====
  'coriander': 'cilantro',
  'chinese parsley': 'cilantro',
  'parsley': 'parsley',
  'basil': 'basil',
  'mint': 'mint',
  
  // ===== LEAFY GREENS =====
  'lettuce': 'lettuce',
  'spinach': 'spinach',
  'kale': 'kale',
  'arugula': 'arugula',
  'rocket': 'arugula',
  
  // ===== OTHER VEGETABLES =====
  'broccoli': 'broccoli',
  'cauliflower': 'cauliflower',
  'cabbage': 'cabbage',
  'celery': 'celery',
  'cucumber': 'cucumber',
  'eggplant': 'eggplant',
  'aubergine': 'eggplant',
  'zucchini': 'zucchini',
  'courgette': 'zucchini',
  'squash': 'squash',
  'pumpkin': 'pumpkin',
  'corn': 'corn',
  'maize': 'corn',
  
  // ===== FRUITS =====
  'apple': 'apple',
  'apples': 'apple',
  'banana': 'banana',
  'bananas': 'banana',
  'orange': 'orange',
  'oranges': 'orange',
  // Citrus variants map to orange
  'citrus': 'orange',
  'citru': 'orange', // fuzzy/truncated OCR/tag
  'mandarin': 'orange',
  'mandarins': 'orange',
  'clementine': 'orange',
  'clementines': 'orange',
  'tangerine': 'orange',
  'tangerines': 'orange',
  'satsuma': 'orange',
  'satsumas': 'orange',
  'blood orange': 'orange',
  'navel orange': 'orange',
  'seville orange': 'orange',
  'calamondin': 'orange',
  'rangpur': 'orange',
  'tangelo': 'orange',
  'lemon': 'lemon',
  'lemons': 'lemon',
  'lime': 'lime',
  'limes': 'lime',
  'mango': 'mango',
  'mangoes': 'mango',
  'mangifera': 'mango',
  'mangifera indica': 'mango',
  'raw mango': 'mango',
  'green mango': 'mango',
  'ripe mango': 'mango',
  'mango fruit': 'mango',
  'avocado': 'avocado',
  'avocados': 'avocado'
}

// Whitelist: Actual ingredient names that should ALWAYS be kept
const VALID_INGREDIENTS = new Set([
  // Proteins - Poultry
  'chicken', 'turkey', 'duck', 'broiler', 'fowl', 'hen', 'poultry', 'bird',
  
  // Proteins - Meat
  'beef', 'pork', 'lamb', 'mutton', 'bacon', 'ham', 'sausage',
  'meat', 'meat product',  // Accept (will be mapped via synonym)
  
  // Proteins - Generic terms (FALLBACKS - will be mapped)
  'animal', 'vertebrate', 'invertebrate',
  
  // Proteins - Seafood & Fish
  'fish', 'salmon', 'tuna', 'cod', 'tilapia', 'mackerel', 'trout', 'halibut', 'catfish',
  'shrimp', 'prawn', 'crab', 'lobster', 'scallops', 'mussels', 'clams', 'oysters',
  'crustacean', 'seafood',  // Accept (will be mapped)
  
  // Proteins - Other
  'egg', 'tofu', 'tempeh',
  
  // Dairy
  'milk', 'cheese', 'butter', 'cream', 'yogurt', 'ghee', 'paneer',
  
  // Vegetables
  'potato', 'tomato', 'onion', 'garlic', 'carrot', 'broccoli', 'spinach',
  'lettuce', 'cabbage', 'cauliflower', 'celery', 'cucumber', 'zucchini',
  'eggplant', 'mushroom', 'pepper', 'chili', 'ginger', 'shallot',
  'peas', 'beans', 'corn', 'asparagus', 'kale', 'chard', 'arugula',
  'squash', 'pumpkin',
  
  // Fruits
  'apple', 'banana', 'orange', 'lemon', 'lime', 'mango', 'grape', 'berry',
  'strawberry', 'blueberry', 'raspberry', 'avocado', 'pineapple',
  
  // Grains & Starches
  'rice', 'pasta', 'bread', 'flour', 'oats', 'quinoa', 'barley',
  'noodles', 'couscous',
  
  // Nuts & Seeds
  'almond', 'walnut', 'peanut', 'cashew', 'sesame', 'sunflower',
  
  // Legumes
  'chickpea', 'lentils', 'lentil',
  
  // Herbs & Spices (specific ones)
  'basil', 'parsley', 'cilantro', 'mint', 'thyme', 'rosemary', 'oregano',
  'cumin', 'turmeric', 'paprika', 'cinnamon', 'cardamom'
])

// ==================== HELPER FUNCTIONS ====================

// Calculate Intersection over Union (IoU) for bounding boxes
const calculateIoU = (box1, box2) => {
  const x1 = Math.max(box1.x, box2.x)
  const y1 = Math.max(box1.y, box2.y)
  const x2 = Math.min(box1.x + box1.w, box2.x + box2.w)
  const y2 = Math.min(box1.y + box1.h, box2.y + box2.h)
  
  if (x2 < x1 || y2 < y1) return 0
  
  const intersection = (x2 - x1) * (y2 - y1)
  const area1 = box1.w * box1.h
  const area2 = box2.w * box2.h
  const union = area1 + area2 - intersection
  
  return intersection / union
}

// Resize image to ~1024px max dimension (JPEG, sRGB)
const prepareImageForAzure = async (uri) => {
  try {
    const baseInfo = await ImageManipulator.manipulateAsync(uri, [], { compress: 1, format: ImageManipulator.SaveFormat.JPEG })
    const maxDim = Math.max(baseInfo.width || 0, baseInfo.height || 0)
    const needResize = maxDim > 1024
    const resizeAction = needResize
      ? (baseInfo.width >= baseInfo.height
          ? [{ resize: { width: 1024 } }]
          : [{ resize: { height: 1024 } }])
      : []

    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      resizeAction,
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    )
    return manipulated.uri
  } catch (e) {
    console.log('prepareImageForAzure error, using original:', e)
    return uri
  }
}

// Analyze a URI with specified features
const analyzeUri = async (uri, config, features) => {
  const prepared = await prepareImageForAzure(uri)
  const base64 = await imageToBase64(prepared)
  return await callAzureVisionAPI(base64, config, features, 'latest')
}

// Crop with padding (pixels), clamped to image bounds
const cropWithPadding = async (uri, box, padding = 10) => {
  try {
    const info = await ImageManipulator.manipulateAsync(uri, [], { compress: 1, format: ImageManipulator.SaveFormat.JPEG })
    const x = Math.max(0, Math.floor((box.x || 0) - padding))
    const y = Math.max(0, Math.floor((box.y || 0) - padding))
    const w = Math.min((info.width || 0) - x, Math.floor((box.w || 0) + padding * 2))
    const h = Math.min((info.height || 0) - y, Math.floor((box.h || 0) + padding * 2))

    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ crop: { originX: x, originY: y, width: w, height: h } }],
      { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
    )
    return result.uri
  } catch (e) {
    console.log('cropWithPadding error, using original:', e)
    return uri
  }
}

// Smart singularization (plurals → singular)
const singularize = (word) => {
  if (!word || word.length < 4) return word
  
  // Common irregular plurals
  const irregulars = {
    'tomatoes': 'tomato',
    'potatoes': 'potato',
    'mangoes': 'mango',
    'avocados': 'avocado',
    'loaves': 'loaf',
    'knives': 'knife',
    'leaves': 'leaf'
  }
  
  if (irregulars[word]) return irregulars[word]
  
  // Regular patterns
  if (word.endsWith('ies') && word.length > 4) {
    return word.slice(0, -3) + 'y'  // berries → berry
  }
  if (word.endsWith('ves')) {
    return word.slice(0, -3) + 'f'  // knives → knife
  }
  if (word.endsWith('ses') || word.endsWith('shes') || word.endsWith('ches') || word.endsWith('xes')) {
    return word.slice(0, -2)  // dishes → dish
  }
  if (word.endsWith('s') && !word.endsWith('ss')) {
    return word.slice(0, -1)  // onions → onion, carrots → carrot
  }
  
  return word
}

// Check if a word is likely a food ingredient (heuristic-based)
const looksLikeFood = (word) => {
  if (!word || word.length < 3) return false
  
  // Food-related suffixes that indicate ingredients
  const foodSuffixes = [
    'berry', 'fruit', 'nut', 'seed', 'bean', 'pea',
    'grain', 'flour', 'milk', 'cream', 'cheese', 'butter',
    'meat', 'fish', 'oil', 'juice', 'sauce', 'paste'
  ]
  
  for (const suffix of foodSuffixes) {
    if (word.endsWith(suffix)) {
      // But reject if it's JUST the suffix (e.g., just "fruit")
      if (word === suffix && BLACKLIST_TERMS.has(suffix)) {
        return false
      }
      return true
    }
  }
  
  // Common food word patterns (simple heuristic)
  // Most food words are 4-12 characters, single or two words
  if (word.length >= 4 && word.length <= 12) {
    const wordCount = word.split(/\s+/).length
    if (wordCount <= 2) {
      return true  // Likely a food if it's a simple 1-2 word term
    }
  }
  
  return false
}

// Canonicalize ingredient name (GENERAL APPROACH - works for ANY ingredient)
const canonicalize = (rawName, confidence) => {
  if (!rawName || typeof rawName !== 'string') return null
  
  let name = rawName.toLowerCase().trim()
  const original = name
  
  console.log(`  🔍 Processing: "${original}" (confidence: ${confidence.toFixed(3)})`)
  
  // ===== STEP 1: BLACKLIST CHECK (reject generic terms) =====
  if (BLACKLIST_TERMS.has(name)) {
    console.log(`    ✗ BLACKLISTED (generic category)`)
    return null
  }
  
  // ===== STEP 2: CLEAN & NORMALIZE =====
  // Remove common prefixes
  name = name.replace(/^(fresh|dried|frozen|canned|organic|raw|cooked|whole|sliced|chopped)\s+/gi, '')
  
  // Remove quantities
  name = name.replace(/^\d+(\.\d+)?\s*(kg|g|grams?|ml|liters?|cups?|tbsp|tsp|oz|lbs?|pounds?|pieces?)\s+/gi, '')
  
  // Remove brand indicators
  name = name.replace(/\b(brand|amul|nestle|kraft)\b/gi, '').trim()
  
  // Clean special characters
  name = name.replace(/[^\w\s-]/g, '').trim()
  
  // Check blacklist again after cleaning
  if (BLACKLIST_TERMS.has(name)) {
    console.log(`    ✗ BLACKLISTED after cleaning`)
    return null
  }
  
  // ===== STEP 3: SYNONYM MAP (explicit mappings) =====
  if (SYNONYM_MAP[name]) {
    const canonical = SYNONYM_MAP[name]
    console.log(`    ✓ MAPPED: "${original}" → "${canonical}"`)
    return { canonical, variants: [original] }
  }
  
  // ===== STEP 4: CONTAINS CHECK (e.g., "cherry tomato" contains "tomato") =====
  // Check if name contains any known ingredient from synonym map
  for (const [key, value] of Object.entries(SYNONYM_MAP)) {
    if (name.includes(value) && value.length >= 4) {
      console.log(`    ✓ CONTAINS: "${original}" → "${value}"`)
      return { canonical: value, variants: [original] }
    }
  }
  
  // ===== STEP 5: SINGULARIZE (onions → onion, carrots → carrot) =====
  const singular = singularize(name)
  if (singular !== name) {
    console.log(`    ✓ SINGULARIZED: "${name}" → "${singular}"`)
    name = singular
    
    // Check if singular form is in synonym map
    if (SYNONYM_MAP[name]) {
      const canonical = SYNONYM_MAP[name]
      console.log(`    ✓ MAPPED (after singularize): "${singular}" → "${canonical}"`)
      return { canonical, variants: [original] }
    }
  }
  
  // ===== STEP 6: BASIC ITEMS CHECK =====
  if (BASIC_ITEMS.has(name)) {
    console.log(`    ✗ BASIC ITEM (too common)`)
    return null
  }
  
  // ===== STEP 7: WHITELIST CHECK (known good ingredients) =====
  if (VALID_INGREDIENTS.has(name)) {
    console.log(`    ✓ WHITELISTED: "${name}"`)
    return { canonical: name, variants: [original] }
  }
  
  // ===== STEP 8: HEURISTIC ACCEPTANCE (NEW - General approach) =====
  const wordCount = name.split(/\s+/).length
  
  // Reject if too long or too short
  if (name.length < 3) {
    console.log(`    ✗ TOO SHORT`)
    return null
  }
  
  if (name.length > 20) {
    console.log(`    ✗ TOO LONG (likely descriptive phrase)`)
    return null
  }
  
  // Reject if too many words (likely a category description)
  if (wordCount > 2) {
    console.log(`    ✗ TOO DESCRIPTIVE (${wordCount} words)`)
    return null
  }
  
  // Accept if it looks like food (heuristic-based)
  if (looksLikeFood(name)) {
    console.log(`    ✓ ACCEPTED (looks like food): "${name}"`)
    return { canonical: name, variants: [original] }
  }
  
  // ===== STEP 9: FINAL FALLBACK (simple 1-word ingredients) =====
  // If it's a simple single word (4-12 chars), accept it
  // This catches things like "pasta", "rice", "garlic", "onion", etc.
  if (wordCount === 1 && name.length >= 4 && name.length <= 12) {
    console.log(`    ✓ ACCEPTED (simple ingredient): "${name}"`)
    return { canonical: name, variants: [original] }
  }
  
  // Reject everything else
  console.log(`    ✗ REJECTED (doesn't match patterns)`)
  return null
}

// Compress image before sending to API
const compressImage = async (uri) => {
  try {
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1280 } }], // Resize to max 1280px width
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
    )
    return manipResult.uri
  } catch (error) {
    console.error('Image compression error:', error)
    return uri // Return original if compression fails
  }
}

// Convert image to base64 using legacy FileSystem API
const imageToBase64 = async (uri) => {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    })
    return base64
  } catch (error) {
    console.error('Base64 conversion error:', error)
    throw error
  }
}

// Call Azure Computer Vision API (v4) with dynamic features/model version
const callAzureVisionAPI = async (base64Image, config, features = ['tags','objects','denseCaptions','read'], modelVersion = 'latest') => {
  const featureParam = Array.isArray(features) ? features.join(',') : String(features)
  const apiUrl = `${config.endpoint}/computervision/imageanalysis:analyze?api-version=2023-10-01&features=${encodeURIComponent(featureParam)}&model-version=${encodeURIComponent(modelVersion)}`
  
  console.log('=== CALLING AZURE API ===')
  console.log('API URL:', apiUrl)
  console.log('Has API Key:', !!config.key)
  console.log('Image size (base64):', base64Image.length, 'characters')
  
  try {
    // Convert base64 to array buffer
    const binaryString = atob(base64Image)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    
    console.log('Converted to bytes:', bytes.length, 'bytes')
    console.log('Making API request...')
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.key,
        'Content-Type': 'application/octet-stream',
      },
      body: bytes,
    })
    
    console.log('API Response Status:', response.status)
    console.log('API Response OK:', response.ok)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Error Response:', errorText)
      throw new Error(`Azure API error: ${response.status} - ${errorText}`)
    }
    
    const jsonResponse = await response.json()
    console.log('API Response received successfully')
    
    return jsonResponse
  } catch (error) {
    console.error('Azure API call error:', error)
    throw error
  }
}

// ==================== MAIN PROCESSING PIPELINE ====================

// Process Azure Vision response with object-first detection
const processVisionResponse = (data) => {
  console.log('\n╔════════════════════════════════════════════╗')
  console.log('║   🔬 AZURE VISION RESPONSE ANALYSIS       ║')
  console.log('╚════════════════════════════════════════════╝\n')
  
  // ===== DEBUG: Show ALL raw Azure response =====
  console.log('🔍 RAW AZURE RESPONSE (before any filtering):\n')
  
  if (data.objectsResult?.values) {
    console.log(`📦 Objects (${data.objectsResult.values.length} total):`)
    data.objectsResult.values.forEach(obj => {
      if (obj.tags?.[0]) {
        console.log(`   - "${obj.tags[0].name}" (confidence: ${obj.tags[0].confidence.toFixed(3)})`)
      }
    })
  } else {
    console.log('📦 Objects: NONE')
  }
  
  if (data.tagsResult?.values) {
    console.log(`\n🏷️  Tags (${data.tagsResult.values.length} total):`)
    data.tagsResult.values.slice(0, 15).forEach(tag => {
      console.log(`   - "${tag.name}" (confidence: ${tag.confidence.toFixed(3)})`)
    })
    if (data.tagsResult.values.length > 15) {
      console.log(`   ... and ${data.tagsResult.values.length - 15} more`)
    }
  } else {
    console.log('\n🏷️  Tags: NONE')
  }
  
  console.log('\n' + '━'.repeat(50) + '\n')
  
  const candidateMap = new Map() // canonical -> { confidence, variants[], boxes[] }
  
  // ===== STEP 1: Process OBJECTS (high confidence, preferred) =====
  console.log('📦 STEP 1: Processing OBJECTS (≥0.30 confidence)\n')
  
  const objects = []
  if (data.objectsResult?.values) {
    data.objectsResult.values.forEach(obj => {
      if (obj.tags?.[0]) {
        const tag = obj.tags[0]
        const box = obj.boundingBox || { x: 0, y: 0, w: 100, h: 100 }
        
        if (tag.confidence >= OBJECT_CONF_MIN) {
          const result = canonicalize(tag.name, tag.confidence)
          
          if (result) {
            objects.push({
              canonical: result.canonical,
              confidence: tag.confidence,
              variant: result.variants[0],
              box: box
            })
            
            // Add to candidate map
            if (!candidateMap.has(result.canonical)) {
              candidateMap.set(result.canonical, {
                confidence: tag.confidence,
                variants: new Set(result.variants),
                boxes: [box],
                source: 'object'
              })
            } else {
              const existing = candidateMap.get(result.canonical)
              existing.confidence = Math.max(existing.confidence, tag.confidence)
              result.variants.forEach(v => existing.variants.add(v))
              existing.boxes.push(box)
            }
          }
        } else {
          console.log(`  ⏭️  SKIPPED (low confidence): "${tag.name}" (${tag.confidence.toFixed(3)})`)
        }
      }
    })
    
    console.log(`\n✅ Objects detected: ${objects.length}`)
  } else {
    console.log('⚠️  No objects found in response\n')
  }
  
  // ===== STEP 2: Process TAGS (very high confidence, supplement only) =====
  console.log('\n🏷️  STEP 2: Processing TAGS (≥0.40 confidence)\n')
  
  const tags = []
  if (data.tagsResult?.values) {
    data.tagsResult.values.forEach(tag => {
      if (tag.confidence >= TAG_CONF_MIN) {
        // Skip if already covered by objects
        const result = canonicalize(tag.name, tag.confidence)
        
        if (result && !candidateMap.has(result.canonical)) {
          tags.push({
            canonical: result.canonical,
            confidence: tag.confidence,
            variant: result.variants[0]
          })
          
          candidateMap.set(result.canonical, {
            confidence: tag.confidence,
            variants: new Set(result.variants),
            boxes: [],
            source: 'tag'
          })
        } else if (result) {
          console.log(`  ⏭️  SKIPPED (already detected): "${tag.name}"`)
        }
      } else {
        console.log(`  ⏭️  SKIPPED (low confidence): "${tag.name}" (${tag.confidence.toFixed(3)})`)
      }
    })
    
    console.log(`\n✅ Tags added: ${tags.length}`)
  } else {
    console.log('⚠️  No tags found in response\n')
  }
  
  // (Reverted) No additional dense caption enrichment here; tags/objects sufficient
  
  // ===== STEP 3: Check for overlapping objects (same item detected multiple times) =====
  console.log('\n🔄 STEP 3: De-duplication & IoU Analysis\n')
  
  if (objects.length > 1) {
    // Check if all objects with the same canonical name have overlapping boxes
    for (const [canonical, data] of candidateMap.entries()) {
      if (data.boxes.length > 1) {
        // Calculate IoU for all box pairs
        let allOverlap = true
        for (let i = 0; i < data.boxes.length - 1; i++) {
          for (let j = i + 1; j < data.boxes.length; j++) {
            const iou = calculateIoU(data.boxes[i], data.boxes[j])
            console.log(`  📐 IoU for "${canonical}": ${iou.toFixed(3)}`)
            
            if (iou < IOU_THRESHOLD) {
              allOverlap = false
            }
          }
        }
        
        if (allOverlap && data.boxes.length > 1) {
          console.log(`  ✂️  MERGED: Multiple overlapping "${canonical}" → keeping one`)
          // Keep only the highest confidence detection
          data.boxes = [data.boxes[0]]
        }
      }
    }
  }
  
  // ===== STEP 4: Semantic Deduplication (Remove related/redundant items) =====
  console.log('\n🧹 STEP 4: Semantic Deduplication\n')
  
  // If multiple ingredients detected, check for semantic overlap
  if (candidateMap.size > 1) {
    const items = Array.from(candidateMap.entries())
    const toRemove = new Set()
    
    // Check each pair of ingredients for semantic similarity
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const [name1, data1] = items[i]
        const [name2, data2] = items[j]
        
        // Skip if already marked for removal
        if (toRemove.has(name1) || toRemove.has(name2)) continue
        
        // Check if one contains the other (e.g., "green onion" vs "onion")
        if (name1.includes(name2)) {
          console.log(`  🔗 "${name1}" contains "${name2}" → keeping more specific: "${name1}"`)
          toRemove.add(name2)
        } else if (name2.includes(name1)) {
          console.log(`  🔗 "${name2}" contains "${name1}" → keeping more specific: "${name2}"`)
          toRemove.add(name1)
        }
        
        // Check if they're in the same semantic family (via synonym map)
        // e.g., both map to same root in different ways
        const family1 = SYNONYM_MAP[name1] || name1
        const family2 = SYNONYM_MAP[name2] || name2
        
        if (family1 === family2 && family1 !== name1 && family1 !== name2) {
          // Both are variants of the same ingredient, keep the canonical one
          console.log(`  🔗 "${name1}" and "${name2}" are variants of "${family1}" → merging`)
          toRemove.add(name1)
          toRemove.add(name2)
          // Add the canonical form
          if (!candidateMap.has(family1)) {
            candidateMap.set(family1, {
              confidence: Math.max(data1.confidence, data2.confidence),
              variants: new Set([name1, name2]),
              boxes: [...data1.boxes, ...data2.boxes],
              source: data1.confidence >= data2.confidence ? data1.source : data2.source
            })
          }
        }

        // (Reverted) No cross-family citrus collapsing here
      }
    }
    
    // Remove marked items
    for (const name of toRemove) {
      candidateMap.delete(name)
      console.log(`  ✂️  Removed duplicate: "${name}"`)
    }
  }
  
  // ===== STEP 5: Build final result =====
  console.log('\n📊 STEP 5: Final Results\n')
  
  const finalIngredients = []
  
  // Sort by confidence and limit to MAX_INGREDIENTS
  const sortedItems = Array.from(candidateMap.entries())
    .sort((a, b) => b[1].confidence - a[1].confidence)
    .slice(0, MAX_INGREDIENTS)
  
  for (const [canonical, data] of sortedItems) {
    const variantList = Array.from(data.variants).filter(v => v !== canonical)
    
    console.log(`✅ "${canonical}"`)
    console.log(`   Confidence: ${data.confidence.toFixed(3)}`)
    console.log(`   Source: ${data.source}`)
    if (variantList.length > 0) {
      console.log(`   Variants detected: ${variantList.join(', ')}`)
    }
    
    finalIngredients.push(canonical)
  }
  
  console.log('\n╔════════════════════════════════════════════╗')
  console.log(`║   ✨ FINAL: ${finalIngredients.length} ingredient(s) detected`)
  console.log('╚════════════════════════════════════════════╝\n')
  console.log(finalIngredients)
  console.log('')
  
  return finalIngredients
}

// Main export function
export const extractItemsFromImage = async (imageUri) => {
  try {
    // Get Azure configuration
    const config = getAzureConfig()
    
    if (!config.key) {
      throw new Error('Azure Vision API key not configured')
    }
    
    console.log('Starting image analysis...')

    // ---- Protein-first robust pipeline (objects → crops → re-tag) ----
    const fullFeatures = ['objects','tags','denseCaptions','read']
    const fullVision = await analyzeUri(imageUri, config, fullFeatures)

    // Collect protein candidates
    const proteinCandidates = new Map() // canon -> {score, sourceRank}
    const recordProtein = (canon, score, sourceRank) => {
      if (!canon) return
      const prev = proteinCandidates.get(canon)
      if (!prev || sourceRank > prev.sourceRank || (sourceRank === prev.sourceRank && score > prev.score)) {
        proteinCandidates.set(canon, { score, sourceRank })
      }
    }

    // Helper to evaluate tags list against protein allow list
    const evalTagsForProteins = (tags, minScore, sourceRank) => {
      if (!Array.isArray(tags)) return false
      let any = false
      for (const t of tags) {
        const canon = proteinSynonymToCanonical(t?.name)
        if (!canon) continue
        // Relax threshold for shellfish slightly to prefer specific shell over generic fish
        const required = SHELL_CANON_SET.has(canon) ? Math.min(minScore, 0.75) : minScore
        if (t?.confidence >= required) {
          recordProtein(canon, t.confidence, sourceRank)
          any = true
        }
      }
      return any
    }

    // Stage A: Full image objects
    if (fullVision.objectsResult?.values?.length) {
      for (const obj of fullVision.objectsResult.values) {
        const primary = obj.tags?.[0]
        const canonObj = proteinSynonymToCanonical(primary?.name)
        // Relax object threshold for shellfish slightly
        const objMin = canonObj && SHELL_CANON_SET.has(canonObj) ? Math.min(PROTEIN_OBJ_MIN, 0.70) : PROTEIN_OBJ_MIN
        if (primary?.confidence >= objMin && canonObj) {
          recordProtein(canonObj, primary.confidence, 3) // object rank highest
        }

        // Crop and re-run tags + dense captions to boost specificity
        const preparedFull = await prepareImageForAzure(imageUri)
        const cropUri = await cropWithPadding(preparedFull, obj.boundingBox || { x: 0, y: 0, w: 100, h: 100 }, 10)
        const cropAnalysis = await analyzeUri(cropUri, config, ['tags','denseCaptions'])

        // Tags inside crop
        evalTagsForProteins(cropAnalysis.tagsResult?.values, PROTEIN_TAG_MIN, 2)

        // Dense captions inside crop (fallback)
        if (cropAnalysis.denseCaptionsResult?.values?.length) {
          for (const cap of cropAnalysis.denseCaptionsResult.values) {
            const canon = proteinSynonymToCanonical(cap.text)
            if (canon) recordProtein(canon, 0.75, 1)
          }
        }
      }
    } else {
      // No objects: use tags on full image
      evalTagsForProteins(fullVision.tagsResult?.values, PROTEIN_TAG_MIN, 2)
    }

    // OCR assist (packaged foods)
    if (fullVision.readResult?.blocks) {
      for (const block of fullVision.readResult.blocks) {
        for (const line of block.lines || []) {
          const canon = proteinSynonymToCanonical(line.text)
          if (canon) recordProtein(canon, 0.9, 2)
        }
      }
    }

    // Dense-caption fallback if nothing yet
    if (proteinCandidates.size === 0 && fullVision.denseCaptionsResult?.values?.length) {
      for (const cap of fullVision.denseCaptionsResult.values) {
        const canon = proteinSynonymToCanonical(cap.text)
        if (canon) recordProtein(canon, 0.75, 1)
      }
    }

    // Retry once with alternative encoding if still empty
    let proteinList = Array.from(proteinCandidates.entries()).map(([k,v]) => ({ canon: k, ...v }))
    if (proteinList.length === 0) {
      const altPrepared = await prepareImageForAzure(imageUri) // same call re-encodes; sufficient for retry
      const retryVision = await analyzeUri(altPrepared, config, fullFeatures)
      if (retryVision.tagsResult?.values) evalTagsForProteins(retryVision.tagsResult.values, PROTEIN_TAG_MIN, 2)
      if (retryVision.denseCaptionsResult?.values) {
        for (const cap of retryVision.denseCaptionsResult.values) {
          const canon = proteinSynonymToCanonical(cap.text)
          if (canon) recordProtein(canon, 0.75, 1)
        }
      }
      proteinList = Array.from(proteinCandidates.entries()).map(([k,v]) => ({ canon: k, ...v }))
    }

    // Dedup & exclusivity across protein groups using scores
    const sortedProteins = proteinList
      .sort((a,b) => b.sourceRank - a.sourceRank || b.score - a.score)

    const landGroup = new Set(['beef','pork','mutton'])
    const shellGroup = new Set(['shrimp','crab','lobster','scallops','mussels','clams','oysters'])
    const poultryGroup = new Set(['chicken','turkey','duck'])

    const best = { land: null, shell: null, poultry: null, fish: null, egg: null }

    for (const item of sortedProteins) {
      const c = item.canon
      if (shellGroup.has(c)) {
        if (!best.shell || item.score > best.shell.score) best.shell = item
        continue
      }
      if (landGroup.has(c)) {
        if (!best.land || item.score > best.land.score) best.land = item
        continue
      }
      if (poultryGroup.has(c)) {
        if (!best.poultry || item.score > best.poultry.score) best.poultry = item
        continue
      }
      if (c === 'fish') {
        if (!best.fish || item.score > best.fish.score) best.fish = item
        continue
      }
      if (c === 'egg') {
        if (!best.egg || item.score > best.egg.score) best.egg = item
        continue
      }
    }

    const proteinsSet = new Set()
    if (best.shell) proteinsSet.add(best.shell.canon)
    else if (best.fish) proteinsSet.add(best.fish.canon)
    if (best.land) proteinsSet.add(best.land.canon)
    if (best.poultry) proteinsSet.add(best.poultry.canon)
    if (best.egg) proteinsSet.add(best.egg.canon)

    const proteins = Array.from(proteinsSet)

    // ---- Veg/other detection via existing pipeline ----
    const base64Image = await imageToBase64(await prepareImageForAzure(imageUri))
    const visionDataForVeg = await callAzureVisionAPI(base64Image, config, ['tags','objects','read'], 'latest')
    const genericItems = processVisionResponse(visionDataForVeg)

    // Remove any protein synonyms from genericItems
    const proteinSyns = new Set([...PROTEIN_SYNONYM_TO_CANON.keys(), ...PROTEIN_CANONICAL_KEYS])
    const vegOnly = genericItems.filter(x => !proteinSyns.has(x))

    // Determine object cluster count (IoU-based) to decide single vs multi-item scene
    const countObjectClusters = (objs) => {
      if (!Array.isArray(objs) || objs.length === 0) return 0
      const clusters = []
      for (const o of objs) {
        const box = o.boundingBox || { x: 0, y: 0, w: 0, h: 0 }
        let placed = false
        for (const cluster of clusters) {
          // If overlaps with any box in cluster, merge into that cluster
          if (cluster.some(b => calculateIoU(b, box) >= IOU_THRESHOLD)) {
            cluster.push(box)
            placed = true
            break
          }
        }
        if (!placed) clusters.push([box])
      }
      return clusters.length
    }
    const objectClusters = countObjectClusters(fullVision.objectsResult?.values || [])

    // Merge protein winners + vegOnly, unique and clipped
    const merged = Array.from(new Set([...proteins, ...vegOnly])).slice(0, MAX_INGREDIENTS)

    // If all detections map to the same canonical head, collapse to one
    const uniqueHeads = new Set(merged)
    const allSameHead = uniqueHeads.size === 1

    // Specificity ranking to choose the most correct label when single item
    const chooseMostSpecific = (items) => {
      if (!items || items.length === 0) return null
      const preferOrder = [
        // Shellfish specifics (most specific first)
        'lobster','crab','shrimp','scallops','mussels','clams','oysters',
        // Fish specifics (over generic fish)
        'salmon','tuna','cod','halibut','trout','tilapia','mackerel','catfish',
        // Poultry specifics
        'chicken','turkey','duck',
        // Land meats specifics
        'beef','pork','lamb','mutton',
        // Egg
        'egg',
        // Generic fish last (if truly nothing else specific)
        'fish'
      ]
      for (const key of preferOrder) {
        if (items.includes(key)) return key
      }
      // Fall back to first detected (already confidence-sorted upstream for veg)
      return items[0]
    }

    // Selection policy:
    // - If all items share one head (e.g., multiple oranges): return that one head
    // - Else if multiple distinct clusters: return all merged items (up to MAX_INGREDIENTS)
    // - Else return the single most-specific best-fit item
    let final = []
    if (allSameHead && merged.length > 0) {
      final = [Array.from(uniqueHeads)[0]]
    } else if (objectClusters > 1) {
      final = merged
    } else {
      const bestOne = chooseMostSpecific(merged)
      final = bestOne ? [bestOne] : []
    }

    console.log(`Detected ${final.length} ingredients:`, final)

    return final
    
  } catch (error) {
    console.error('Image scanning error:', error)
    throw error
  }
}

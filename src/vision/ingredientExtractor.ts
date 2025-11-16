/**
 * Ingredient Extractor
 * 
 * Universal pipeline to extract clean, canonical ingredient names from Azure Vision results.
 * Handles: mango (single + pile), shrimp/chicken/fish duplicates, milk/dairy/drink noise.
 * 
 * No per-item mapping - uses semantic headword collapsing and generic filtering.
 */

// ==================== TYPES ====================

export type AzureResult = {
  tags?: { name: string; confidence: number }[]
  objects?: { name: string; confidence: number }[]
  captions?: { text: string; confidence: number }[]
}

type Cand = {
  name: string
  src: 'tag' | 'obj' | 'cap'
  conf: number
}

// ==================== CONSTANTS ====================

// Generic terms to drop (unless no specific survives)
const GENERIC = new Set([
  'food', 'produce', 'fruit', 'vegetable', 'animal', 'meat', 'seafood',
  'invertebrate', 'crustacean', 'dairy', 'drink', 'beverage', 'natural foods',
  'whole food', 'local food', 'diet food', 'vegan nutrition', 'vegetarian food', 'superfood'
])

// Descriptors to strip
const DESCRIPTORS = new Set([
  'fresh', 'raw', 'ripe', 'green', 'boiled', 'cooked', 'sliced', 'whole', 'fillet', 'cut', 'piece', 'market'
])

// Universal "heads" to collapse phrases to (keep small but broad)
const HEADS = new Set([
  // proteins
  'chicken', 'egg', 'fish', 'shrimp', 'prawn', 'lobster', 'crab', 'mutton', 'lamb', 'beef', 'pork', 'turkey', 'duck',
  // dairy
  'milk', 'yogurt', 'cheese', 'paneer', 'butter', 'ghee',
  // fungi
  'mushroom',
  // staples
  'rice', 'wheat', 'flour', 'bread', 'pasta', 'noodle', 'oil', 'salt', 'sugar',
  // fruits
  'mango', 'banana', 'apple', 'orange', 'lemon', 'lime', 'grape', 'pineapple', 'papaya',
  // veg
  'potato', 'onion', 'tomato', 'garlic', 'ginger', 'carrot', 'cabbage', 'cauliflower',
  'cucumber', 'pepper', 'chili', 'spinach', 'broccoli', 'beans', 'pea', 'corn'
])

// Thresholds
const TH_OBJ_TAG = 0.40 // min confidence to consider
const TH_KEEP = 0.55 // min final score to return
const DOM_RATIO = 1.5 // dominance multiplier
const DOM_MIN = 0.80 // dominance absolute

// ==================== NORMALIZATION HELPERS ====================

/**
 * Convert to singular form
 */
const toSingular = (w: string): string => {
  if (/^tomatoes$/.test(w)) return 'tomato'
  if (/^potatoes$/.test(w)) return 'potato'
  if (/^leaves$/.test(w)) return 'leaf'
  if (/^fungi$/.test(w)) return 'fungus'
  if (/^(?:.*?)(ses|xes|zes|ches|shes)$/.test(w)) return w.replace(/es$/, '')
  if (/^(?:.*[^s])s$/.test(w)) return w.replace(/s$/, '')
  return w
}

/**
 * Clean and normalize string
 */
const clean = (s: string): string =>
  s.toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Strip descriptors from phrase
 */
const stripDescriptors = (phrase: string): string =>
  phrase.split(' ')
    .filter(t => !DESCRIPTORS.has(t))
    .join(' ')
    .trim()

/**
 * Extract headword from phrase
 * Prefer right-most known head (e.g., "anchovy fish" -> fish, "king oyster mushroom" -> mushroom)
 */
const headword = (phrase: string): string | null => {
  const toks = phrase.split(' ').map(toSingular)
  
  // Check from right to left
  for (let i = toks.length - 1; i >= 0; i--) {
    if (HEADS.has(toks[i])) return toks[i]
  }
  
  // Fall back: single token ingredient itself if it is a head
  return HEADS.has(toks[0]) && toks.length === 1 ? toks[0] : null
}

// ==================== CANDIDATE GENERATION ====================

/**
 * Extract all candidates from Azure result
 */
function candidates(res: AzureResult): Cand[] {
  const c: Cand[] = []
  
  // Objects
  res.objects?.forEach(o => c.push({ name: o.name, src: 'obj', conf: o.confidence }))
  
  // Tags
  res.tags?.forEach(t => c.push({ name: t.name, src: 'tag', conf: t.confidence }))
  
  // Captions - break into 1-2 word chunks (heads will reduce later)
  res.captions?.forEach(cp => {
    clean(cp.text).split(/[.,]/).forEach(seg => {
      seg.split(' ').forEach(tok => {
        if (tok.length >= 3) c.push({ name: tok, src: 'cap', conf: cp.confidence })
      })
    })
  })
  
  return c
}

// ==================== SCORING ====================

/**
 * Score a candidate based on various factors
 */
function scoreCand(
  c: Cand,
  inBoth: boolean,
  inCaption: boolean,
  generic: boolean
): number {
  let s = Math.max(0, Math.min(1, c.conf))
  
  if (inBoth) s += 0.15
  if (inCaption) s += 0.10
  if (generic) s -= 0.30
  
  return Math.max(0, Math.min(1, s))
}

// ==================== MAIN LOGIC ====================

/**
 * Reduce candidates and score them
 */
function reduceAndScore(res: AzureResult): Array<{ name: string; score: number }> {
  // Extract and normalize raw candidates
  const raw = candidates(res)
    .map(c => ({ ...c, name: clean(stripDescriptors(c.name)) }))
    .filter(c => c.name && c.name.length >= 3)
  
  console.log(`📋 Raw candidates: ${raw.length}`)
  
  // Index presence by key
  const byKey = new Map<string, Cand[]>()
  for (const c of raw) {
    const key = toSingular(c.name)
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(c)
  }
  
  console.log(`🔑 Unique keys: ${byKey.size}`)
  
  // Collapse phrases to headwords; drop generics
  const pool = new Map<string, {
    name: string
    srcs: Set<string>
    conf: number
    generic: boolean
    inCap: boolean
  }>()
  
  for (const [key, list] of byKey) {
    const generic = GENERIC.has(key)
    const collapsed = headword(key) ?? (generic ? null : key) // keep non-generic singletons
    
    if (!collapsed) {
      console.log(`  ❌ Dropped: "${key}" (generic: ${generic}, no headword)`)
      continue
    }
    
    const best = list.reduce((a, b) => (b.conf > a.conf ? b : a))
    const inCap = list.some(x => x.src === 'cap')
    const srcs = new Set(list.map(x => x.src))
    const k = toSingular(collapsed)
    
    const existing = pool.get(k)
    if (!existing || best.conf > existing.conf) {
      pool.set(k, { name: k, srcs, conf: best.conf, generic, inCap })
      console.log(`  ✅ Added: "${key}" → "${k}" (conf: ${best.conf.toFixed(2)})`)
    } else {
      existing.srcs = new Set([...existing.srcs, ...srcs])
      existing.inCap = existing.inCap || inCap
      console.log(`  🔄 Merged: "${key}" → "${k}" (existing)`)
    }
  }
  
  console.log(`🎯 Pool size: ${pool.size}`)
  
  // Specificity: drop parents if child exists (e.g., 'fish' vs 'shrimp')
  const meatSea = new Set(['meat', 'seafood', 'fish', 'animal', 'crustacean', 'invertebrate'])
  const specificProteins = ['chicken', 'shrimp', 'prawn', 'lobster', 'crab']
  
  if ([...pool.keys()].some(k => specificProteins.includes(k))) {
    for (const k of meatSea) {
      if (pool.delete(k)) {
        console.log(`  🗑️  Removed parent: "${k}" (specific protein exists)`)
      }
    }
  }
  
  // Score
  const scored = [...pool.values()].map(p => ({
    name: p.name,
    score: scoreCand(
      { name: p.name, src: 'tag', conf: p.conf }, // conf proxy
      p.srcs.has('tag') && p.srcs.has('obj'),
      p.inCap,
      GENERIC.has(p.name)
    )
  }))
  
  console.log(`📊 Scored: ${scored.length} items`)
  scored.forEach(s => console.log(`   "${s.name}": ${s.score.toFixed(2)}`))
  
  // Fallback: if nothing, allow top > .95 (prevents 'fruit only' = nothing)
  if (!scored.length) {
    const top = [...byKey.entries()]
      .map(([k, v]) => ({ k, conf: Math.max(...v.map(x => x.conf)) }))
      .sort((a, b) => b.conf - a.conf)[0]
    
    if (top && top.conf >= 0.95) {
      console.log(`🆘 Fallback: "${top.k}" (conf: ${top.conf.toFixed(2)})`)
      return [{ name: toSingular(top.k), score: top.conf }]
    }
  }
  
  // Sort & dominance
  scored.sort((a, b) => b.score - a.score)
  
  if (scored[0]?.score >= DOM_MIN && scored[0].score >= (scored[1]?.score ?? 0) * DOM_RATIO) {
    console.log(`🎯 Dominance: "${scored[0].name}" (${scored[0].score.toFixed(2)}) >> others`)
    return [scored[0]]
  }
  
  const result = scored.filter(s => s.score >= TH_KEEP).slice(0, 3)
  console.log(`✅ Final: ${result.length} items`, result.map(r => r.name))
  
  return result
}

// ==================== PUBLIC API ====================

/**
 * Extract ingredients with scores from Azure Vision result
 * 
 * @param res - Azure Vision result with tags, objects, and captions
 * @returns Array of ingredients with scores (1-3 items)
 */
export function extractIngredientsWithScores(res: AzureResult): Array<{ name: string; score: number }> {
  console.log('\n🔬 INGREDIENT EXTRACTION')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  const result = reduceAndScore(res)
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  
  return result
}

/**
 * Extract ingredient names from Azure Vision result
 * 
 * @param res - Azure Vision result with tags, objects, and captions
 * @returns Array of ingredient names (1-3 items)
 */
export function extractIngredients(res: AzureResult): string[] {
  return reduceAndScore(res).map(x => x.name)
}


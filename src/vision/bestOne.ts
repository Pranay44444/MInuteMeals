/**
 * Best One Picker - Post-Processing Module
 * 
 * Takes Azure Vision result and produces ONE final food ingredient
 * chosen by confidence, agreement, and semantic consistency.
 * 
 * NO MANUAL MAPPINGS - fully dynamic based on Azure output
 */

// ==================== TYPES ====================

type AzureTag = {
  name: string
  confidence: number
}

type AzureObject = {
  tags?: Array<{ name: string; confidence: number }>
  boundingBox?: {
    x: number
    y: number
    w: number
    h: number
  }
}

type AzureCaption = {
  text: string
  confidence: number
}

export type AzureOutput = {
  tagsResult?: {
    values: AzureTag[]
  }
  objectsResult?: {
    values: AzureObject[]
  }
  denseCaptionsResult?: {
    values: AzureCaption[]
  }
}

type TokenScore = {
  token: string
  tagConf: number
  captionFreq: number
  consistency: number
  totalScore: number
  featureGroups: Set<string>
}

// ==================== CONFIGURATION ====================

// Generic terms to remove (exact matching only)
const GENERICS = new Set([
  'food', 'produce', 'fruit', 'vegetable', 'animal',
  'meat', 'seafood', 'close', 'local', 'red', 'green',
  'nutrition', 'staple', 'whole', 'cuisine', 'natural', 'raw',
  // Additional noise terms
  'closeup', 'white', 'yellow', 'brown', 'pink', 'blue',
  'fresh', 'organic', 'healthy', 'diet', 'indoor', 'outdoor',
  'table', 'plate', 'bowl', 'dish', 'background', 'surface',
  'top', 'view', 'image', 'photo', 'picture', 'closeup',
  'invertebrate', 'crustacean', 'mollusk', 'shellfish',
  'dairy', 'drink', 'beverage', 'poultry', 'ingredient'
])

// Scoring weights
const WEIGHT_TAG = 0.55
const WEIGHT_CAPTION = 0.30
const WEIGHT_CONSISTENCY = 0.15

// Thresholds
const CLOSE_MARGIN = 0.12

// ==================== NORMALIZATION ====================

/**
 * Basic singularization (no manual food mappings)
 */
function singularize(word: string): string {
  // Common patterns only
  if (word === 'tomatoes') return 'tomato'
  if (word === 'potatoes') return 'potato'
  if (word === 'shrimps') return 'shrimp'
  if (word === 'prawns') return 'prawn'
  if (word === 'mangoes') return 'mango'
  
  // Special cases that end in 'us' (don't pluralize with 's')
  if (word === 'octopus' || word === 'cactus' || word === 'fungus') {
    return word
  }
  
  // Generic patterns
  if (/^(?:.*?)(ses|xes|zes|ches|shes)$/.test(word)) {
    return word.replace(/es$/, '')
  }
  if (/^(?:.*[^s])s$/.test(word)) {
    return word.replace(/s$/, '')
  }
  
  return word
}

/**
 * Normalize token: lowercase, strip punctuation, singularize
 */
function normalizeToken(text: string): string {
  return singularize(
    text.toLowerCase()
      .replace(/[^\p{L}\s]/gu, '')
      .trim()
  )
}

/**
 * Check if token is valid (letters only, >=3 chars)
 */
function isValidToken(token: string): boolean {
  if (token.length < 3) return false
  if (!/^[a-z]+$/.test(token)) return false
  if (GENERICS.has(token)) return false
  return true
}

// ==================== EXTRACTION ====================

/**
 * Extract tokens from tags with confidence
 */
function extractFromTags(tags: AzureTag[]): Map<string, number> {
  const tokenMap = new Map<string, number>()
  
  for (const tag of tags) {
    const normalized = normalizeToken(tag.name)
    if (!isValidToken(normalized)) continue
    
    // Keep highest confidence
    const existing = tokenMap.get(normalized) || 0
    if (tag.confidence > existing) {
      tokenMap.set(normalized, tag.confidence)
    }
  }
  
  return tokenMap
}

/**
 * Extract tokens from captions (nouns only heuristic)
 */
function extractFromCaptions(captions: AzureCaption[]): Map<string, number> {
  const tokenFreq = new Map<string, number>()
  
  for (const caption of captions) {
    const words = caption.text.toLowerCase().split(/\s+/)
    
    for (const word of words) {
      const normalized = normalizeToken(word)
      if (!isValidToken(normalized)) continue
      
      // Count frequency across captions
      const count = tokenFreq.get(normalized) || 0
      tokenFreq.set(normalized, count + 1)
    }
  }
  
  return tokenFreq
}

/**
 * Extract tokens from objects (non-generic only)
 */
function extractFromObjects(objects: AzureObject[]): Set<string> {
  const tokens = new Set<string>()
  
  for (const obj of objects) {
    if (!obj.tags) continue
    
    for (const tag of obj.tags) {
      const normalized = normalizeToken(tag.name)
      if (!isValidToken(normalized)) continue
      
      tokens.add(normalized)
    }
  }
  
  return tokens
}

// ==================== SCORING ====================

/**
 * Build score for each token
 */
function buildScores(
  tagTokens: Map<string, number>,
  captionTokens: Map<string, number>,
  objectTokens: Set<string>,
  totalCaptions: number
): TokenScore[] {
  // Collect all unique tokens
  const allTokens = new Set<string>([
    ...tagTokens.keys(),
    ...captionTokens.keys(),
    ...objectTokens
  ])
  
  const scores: TokenScore[] = []
  
  for (const token of allTokens) {
    // 1. Tag confidence (0.55 weight)
    const tagConf = tagTokens.get(token) || 0
    
    // 2. Caption frequency (0.30 weight)
    const captionCount = captionTokens.get(token) || 0
    const captionFreq = totalCaptions > 0 ? captionCount / totalCaptions : 0
    
    // 3. Consistency - appears in >=2 feature groups (0.15 weight)
    const featureGroups = new Set<string>()
    if (tagConf > 0) featureGroups.add('tags')
    if (captionCount > 0) featureGroups.add('captions')
    if (objectTokens.has(token)) featureGroups.add('objects')
    
    const consistency = featureGroups.size >= 2 ? 1.0 : 0.0
    
    // Disqualify tokens that appear ONLY in captions
    // (must be in tags OR objects to be valid)
    if (featureGroups.size === 1 && featureGroups.has('captions')) {
      console.log(`  ❌ Disqualified "${token}" (captions only, not in tags/objects)`)
      continue
    }
    
    // Calculate total score
    const totalScore =
      WEIGHT_TAG * tagConf +
      WEIGHT_CAPTION * captionFreq +
      WEIGHT_CONSISTENCY * consistency
    
    scores.push({
      token,
      tagConf,
      captionFreq,
      consistency,
      totalScore,
      featureGroups
    })
  }
  
  return scores
}

/**
 * Select the single best token
 */
function selectBest(scores: TokenScore[]): string | null {
  if (scores.length === 0) return null
  
  // Sort by total score descending
  scores.sort((a, b) => b.totalScore - a.totalScore)
  
  // Log top 5
  console.log('\n📊 Top candidates:')
  for (let i = 0; i < Math.min(5, scores.length); i++) {
    const s = scores[i]
    console.log(
      `  ${i + 1}. ${s.token}: ${s.totalScore.toFixed(3)} ` +
      `(tag:${s.tagConf.toFixed(2)} cap:${s.captionFreq.toFixed(2)} ` +
      `cons:${s.consistency.toFixed(1)} groups:${s.featureGroups.size})`
    )
  }
  
  const winner = scores[0]
  
  // Check if top two are close
  if (scores.length > 1) {
    const second = scores[1]
    const margin = winner.totalScore - second.totalScore
    
    if (margin < CLOSE_MARGIN) {
      console.log(
        `  ⚖️  Close call: ${winner.token} (${winner.totalScore.toFixed(3)}) ` +
        `vs ${second.token} (${second.totalScore.toFixed(3)}) - margin: ${margin.toFixed(3)}`
      )
      
      // Tiebreaker: pick the one in more feature groups
      if (winner.featureGroups.size < second.featureGroups.size) {
        console.log(`  → Tiebreaker: ${second.token} (more feature groups: ${second.featureGroups.size} vs ${winner.featureGroups.size})`)
        return second.token
      } else if (winner.featureGroups.size === second.featureGroups.size) {
        // If same groups, prefer higher tag confidence
        if (second.tagConf > winner.tagConf) {
          console.log(`  → Tiebreaker: ${second.token} (higher tag conf: ${second.tagConf.toFixed(2)} vs ${winner.tagConf.toFixed(2)})`)
          return second.token
        }
      }
    }
  }
  
  console.log(`  ✅ Winner: ${winner.token} (score: ${winner.totalScore.toFixed(3)})`)
  
  return winner.token
}

// ==================== MAIN API ====================

/**
 * Pick the best ONE ingredient from Azure output
 * 
 * @param azureOutput - Raw Azure Vision result
 * @returns Single best ingredient token or null
 */
export function pickBestOne(azureOutput: AzureOutput): string | null {
  console.log('\n╔═══════════════════════════════════════════╗')
  console.log('║  🎯 BEST ONE PICKER (Post-Processing)   ║')
  console.log('╚═══════════════════════════════════════════╝')
  
  try {
    // 1. Extract tokens from all sources
    const tags = azureOutput.tagsResult?.values || []
    const captions = azureOutput.denseCaptionsResult?.values || []
    const objects = azureOutput.objectsResult?.values || []
    
    const tagTokens = extractFromTags(tags)
    const captionTokens = extractFromCaptions(captions)
    const objectTokens = extractFromObjects(objects)
    
    console.log(`📋 Extracted: ${tagTokens.size} tag tokens, ${captionTokens.size} caption tokens, ${objectTokens.size} object tokens`)
    
    // 2. Build scores
    const scores = buildScores(tagTokens, captionTokens, objectTokens, captions.length)
    
    console.log(`🎯 Valid candidates: ${scores.length}`)
    
    // 3. Select best
    const best = selectBest(scores)
    
    console.log('╚═══════════════════════════════════════════╝\n')
    
    return best
    
  } catch (error) {
    console.error('❌ Best one picker error:', error)
    return null
  }
}


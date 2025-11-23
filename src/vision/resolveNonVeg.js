const toWords = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3)

const singular = (w) => {
  if (w === 'tomatoes') return 'tomato'
  if (w === 'potatoes') return 'potato'
  if (w.endsWith('ses') || w.endsWith('xes') || w.endsWith('ches') || w.endsWith('shes')) {
    return w.replace(/es$/, '')
  }
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1)
  return w
}

const GENERIC = new Set([
  'food',
  'produce',
  'fruit',
  'vegetable',
  'animal',
  'animals',
  'meat',
  'seafood',
  'fat',
  'skin',
  'piece',
  'pieces',
  'close',
  'local',
  'natural',
  'raw',
  'diet',
  'nutrition',
  'indoor',
  'wood',
  'wooden',
  'surface',
  'flesh'
])

export function resolveNonVeg(
  finalCandidates,
  azureTags,
  azureCaptions
) {
  const tagWords = azureTags.flatMap(t => toWords(t.name).map(singular))
  const capWords = azureCaptions.flatMap(c => toWords(c.text).map(singular))
  const allWords = [...tagWords, ...capWords]

  // High-level guard: only run on clearly meat/seafood-like scenes
  const hasMeatSignal = allWords.some(w =>
    ['meat', 'seafood', 'fish', 'poultry', 'chicken', 'mutton', 'lamb', 'goat', 'beef', 'pork'].includes(w)
  )

  if (!hasMeatSignal) {
    return null
  }

  // Scene-level meat vs non-meat check
  const hasMeatWord = allWords.includes('meat')
  const hasFoodWord = allWords.includes('food')

  const hasAnimalFat =
    azureTags.some(t => t.name.toLowerCase().includes('animal fat')) ||
    azureCaptions.some(c => c.text.toLowerCase().includes('animal fat'))

  const hasRawMeatCaption = azureCaptions.some(c => {
    const text = c.text.toLowerCase()
    return text.includes('raw meat') || text.includes('pile of raw meat')
  })

  const isMeatFoodScene = hasMeatWord || hasRawMeatCaption || (hasFoodWord && hasAnimalFat)

  const allTokens = new Map()

  const addToken = (token, from) => {
    token = singular(token)
    if (!token || GENERIC.has(token)) return
    const existing = allTokens.get(token) ?? { inFinal: false, inTag: false, inCap: false }
    if (from === 'final') existing.inFinal = true
    if (from === 'tag') existing.inTag = true
    if (from === 'cap') existing.inCap = true
    allTokens.set(token, existing)
  }

  finalCandidates.forEach(name => {
    toWords(name).forEach(w => addToken(w, 'final'))
  })
  tagWords.forEach(w => addToken(w, 'tag'))
  capWords.forEach(w => addToken(w, 'cap'))

  const specifics = []
  for (const [token, flags] of allTokens.entries()) {
    const { inFinal, inTag, inCap } = flags
    let score = 0
    if (inFinal) score += 1.0
    if (inTag) score += 0.8
    if (inCap) score += 0.6
    if (score < 0.8) continue
    specifics.push({ token, score })
  }

  if (specifics.length > 0) {
    specifics.sort((a, b) => b.score - a.score)
    return specifics[0].token
  }

  // No specific animal token with enough support
  if (isMeatFoodScene) {
    // Ambiguous raw meat scene → treat as generic meat
    return 'meat'
  }

  // Non-meat scenes (e.g., human skin/hand with "flesh") → no ingredient
  return null
}

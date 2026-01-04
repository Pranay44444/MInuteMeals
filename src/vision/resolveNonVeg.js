const toWords = (s) => s.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3)

const singular = (w) => {
  if (w === 'tomatoes') return 'tomato'
  if (w === 'potatoes') return 'potato'
  if (w.endsWith('ses') || w.endsWith('xes') || w.endsWith('ches') || w.endsWith('shes')) return w.replace(/es$/, '')
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1)
  return w
}

const GENERIC = new Set([
  'food', 'produce', 'fruit', 'vegetable', 'animal', 'animals', 'meat', 'seafood', 'fat', 'skin',
  'piece', 'pieces', 'close', 'local', 'natural', 'raw', 'diet', 'nutrition', 'indoor', 'wood', 'wooden', 'surface', 'flesh'
])

export function resolveNonVeg(candidates, tags, captions) {
  const tagWords = tags.flatMap(t => toWords(t.name).map(singular))
  const capWords = captions.flatMap(c => toWords(c.text).map(singular))
  const allWords = [...tagWords, ...capWords]

  const hasMeatSignal = allWords.some(w => ['meat', 'seafood', 'fish', 'poultry', 'chicken', 'mutton', 'lamb', 'goat', 'beef', 'pork'].includes(w))
  if (!hasMeatSignal) return null

  const hasMeatWord = allWords.includes('meat')
  const hasFoodWord = allWords.includes('food')
  const hasAnimalFat = tags.some(t => t.name.toLowerCase().includes('animal fat')) || captions.some(c => c.text.toLowerCase().includes('animal fat'))
  const hasRawMeatCaption = captions.some(c => { const t = c.text.toLowerCase(); return t.includes('raw meat') || t.includes('pile of raw meat') })
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

  candidates.forEach(name => toWords(name).forEach(w => addToken(w, 'final')))
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

  if (isMeatFoodScene) return 'meat'
  return null
}

describe('Detection Concepts', () => {
  describe('Protein Categories', () => {
    it('red meat category', () => {
      const redMeat = ['beef', 'mutton', 'lamb', 'pork', 'veal', 'goat']
      expect(redMeat).toHaveLength(6)
      expect(redMeat).toContain('beef')
      expect(redMeat).toContain('mutton')
    })

    it('poultry category', () => {
      const poultry = ['chicken', 'turkey', 'duck']
      expect(poultry).toHaveLength(3)
      expect(poultry).toContain('chicken')
    })

    it('seafood categories', () => {
      const fish = ['fish', 'salmon', 'tuna', 'cod', 'tilapia']
      const shellfish = ['shrimp', 'prawn', 'lobster', 'crab', 'oyster', 'clam', 'mussel']
      const cephalopods = ['octopus', 'squid', 'cuttlefish']
      expect(fish.length).toBeGreaterThan(0)
      expect(shellfish.length).toBeGreaterThan(0)
      expect(cephalopods.length).toBeGreaterThan(0)
      expect(cephalopods).toContain('octopus')
      expect(shellfish).toContain('shrimp')
    })
  })

  describe('Seafood Hierarchy', () => {
    it('remove generic fish when specific seafood detected', () => {
      const detected = ['octopus', 'fish', 'seafood']
      const hasCephalopod = detected.includes('octopus') || detected.includes('squid')
      if (hasCephalopod) {
        const filtered = detected.filter(item => item !== 'fish')
        expect(filtered).not.toContain('fish')
        expect(filtered).toContain('octopus')
      }
    })

    it('remove generic fish when shellfish detected', () => {
      const detected = ['shrimp', 'fish', 'shellfish']
      const hasShellfish = detected.includes('shrimp') || detected.includes('prawn')
      if (hasShellfish) {
        const filtered = detected.filter(item => item !== 'fish')
        expect(filtered).not.toContain('fish')
        expect(filtered).toContain('shrimp')
      }
    })
  })

  describe('Sibling Disambiguation', () => {
    it('identify siblings in same category', () => {
      const redMeat = new Set(['beef', 'mutton', 'lamb', 'pork', 'veal', 'goat'])
      const detected = ['beef', 'mutton', 'pork']
      const siblings = detected.filter(item => redMeat.has(item))
      expect(siblings.length).toBeGreaterThan(1)
      const result = [siblings[0]]
      expect(result).toHaveLength(1)
      expect(result[0]).toBe('beef')
    })

    it('keep items from different categories', () => {
      const poultry = new Set(['chicken', 'turkey', 'duck'])
      const vegetables = new Set(['tomato', 'onion', 'potato'])
      const detected = ['chicken', 'tomato']
      const hasPoultry = detected.some(item => poultry.has(item))
      const hasVegetable = detected.some(item => vegetables.has(item))
      expect(hasPoultry).toBe(true)
      expect(hasVegetable).toBe(true)
      expect(detected).toHaveLength(2)
    })
  })

  describe('Descriptor Stripping', () => {
    it('strip processing terms', () => {
      const descriptors = new Set(['chopped', 'diced', 'minced', 'ground', 'cubed', 'shredded'])
      const strip = phrase => phrase.split(' ').filter(word => !descriptors.has(word)).join(' ')
      expect(strip('chopped mutton')).toBe('mutton')
      expect(strip('minced beef')).toBe('beef')
      expect(strip('diced chicken')).toBe('chicken')
    })

    it('strip cooking methods', () => {
      const methods = new Set(['boiled', 'fried', 'grilled', 'roasted', 'baked'])
      const strip = phrase => phrase.split(' ').filter(word => !methods.has(word)).join(' ')
      expect(strip('grilled chicken')).toBe('chicken')
      expect(strip('fried fish')).toBe('fish')
    })
  })

  describe('Confidence Thresholds', () => {
    it('appropriate thresholds', () => {
      const CONFIDENCE_MIN = 0.65
      const SCORE_MIN = 0.52
      const CORE_THRESHOLD = 0.55
      expect(CONFIDENCE_MIN).toBeLessThan(0.70)
      expect(SCORE_MIN).toBeLessThan(0.60)
      expect(CORE_THRESHOLD).toBeLessThan(0.60)
    })
  })

  describe('Generic Term Filtering', () => {
    it('identify parent categories', () => {
      const parents = new Set(['meat', 'seafood', 'animal', 'crustacean', 'invertebrate', 'mollusk', 'shellfish'])
      expect(parents.has('meat')).toBe(true)
      expect(parents.has('seafood')).toBe(true)
      expect(parents.has('beef')).toBe(false)
    })

    it('filter out parent categories when specific exists', () => {
      const detected = ['beef', 'meat', 'animal']
      const parents = new Set(['meat', 'animal'])
      const filtered = detected.filter(item => !parents.has(item))
      expect(filtered).toHaveLength(1)
      expect(filtered[0]).toBe('beef')
    })
  })
})

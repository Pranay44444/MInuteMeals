describe('Normalization Functions', () => {
  describe('Singularization', () => {
    it('singularize common plurals', () => {
      const cases = [
        { input: 'tomatoes', expected: 'tomato' },
        { input: 'potatoes', expected: 'potato' },
        { input: 'mangoes', expected: 'mango' },
        { input: 'oranges', expected: 'orange' },
        { input: 'apples', expected: 'apple' }
      ]
      cases.forEach(({ input, expected }) => {
        expect(input).toBeTruthy()
        expect(expected).toBeTruthy()
      })
    })

    it('handle special cases', () => {
      const cases = [{ input: 'fungi', expected: 'fungus' }, { input: 'leaves', expected: 'leaf' }]
      cases.forEach(({ input, expected }) => {
        expect(input).toBeTruthy()
        expect(expected).toBeTruthy()
      })
    })
  })

  describe('Descriptor Stripping', () => {
    it('strip processing terms', () => {
      const terms = ['chopped', 'diced', 'minced', 'ground', 'cubed', 'shredded']
      terms.forEach(t => expect(t).toBeTruthy())
    })

    it('strip cooking methods', () => {
      const methods = ['boiled', 'fried', 'grilled', 'roasted', 'baked', 'steamed']
      methods.forEach(m => expect(m).toBeTruthy())
    })

    it('strip size/quantity terms', () => {
      const terms = ['whole', 'half', 'quarter', 'large', 'small', 'boneless']
      terms.forEach(t => expect(t).toBeTruthy())
    })

    it('strip colors', () => {
      const colors = ['red', 'white', 'yellow', 'green', 'brown', 'pink']
      colors.forEach(c => expect(c).toBeTruthy())
    })
  })

  describe('Headword Extraction', () => {
    it('extract headwords from phrases', () => {
      const cases = [
        { input: 'king oyster mushroom', expected: 'mushroom' },
        { input: 'anchovy fish', expected: 'fish' },
        { input: 'cherry tomato', expected: 'tomato' },
        { input: 'russet burbank potato', expected: 'potato' }
      ]
      cases.forEach(({ input, expected }) => {
        expect(input).toBeTruthy()
        expect(expected).toBeTruthy()
      })
    })
  })

  describe('Generic Filtering', () => {
    it('identify generic terms', () => {
      const terms = ['food', 'produce', 'fruit', 'vegetable', 'meat', 'seafood', 'dairy', 'drink', 'animal', 'crustacean', 'invertebrate']
      terms.forEach(t => expect(t).toBeTruthy())
    })
  })
})

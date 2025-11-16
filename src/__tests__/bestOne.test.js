/**
 * Comprehensive Tests for Best One Picker
 * Verifies post-processing module that picks exactly ONE ingredient
 */

import { pickBestOne } from '../vision/bestOne'

describe('Best One Picker - Post-Processing', () => {
  beforeEach(() => {
    // Silence console logs during tests
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Single Item Detection', () => {
    it('should detect chicken from tags and captions', () => {
      const azureOutput = {
        tagsResult: {
          values: [
            { name: 'chicken', confidence: 0.92 },
            { name: 'meat', confidence: 0.78 },
            { name: 'poultry', confidence: 0.65 }
          ]
        },
        denseCaptionsResult: {
          values: [
            { text: 'a chicken on a plate', confidence: 0.85 }
          ]
        },
        objectsResult: {
          values: [
            {
              tags: [{ name: 'chicken', confidence: 0.88 }],
              boundingBox: { x: 10, y: 10, w: 80, h: 80 }
            }
          ]
        }
      }

      const result = pickBestOne(azureOutput)

      expect(result).toBe('chicken')
    })

    it('should detect mutton from mixed sources', () => {
      const azureOutput = {
        tagsResult: {
          values: [
            { name: 'mutton', confidence: 0.72 },
            { name: 'meat', confidence: 0.85 }
          ]
        },
        denseCaptionsResult: {
          values: [
            { text: 'chopped mutton pieces on a cutting board', confidence: 0.78 }
          ]
        },
        objectsResult: {
          values: [
            {
              tags: [{ name: 'mutton', confidence: 0.68 }],
              boundingBox: { x: 5, y: 5, w: 90, h: 90 }
            }
          ]
        }
      }

      const result = pickBestOne(azureOutput)

      expect(result).toBe('mutton')
    })

    it('should detect mango', () => {
      const azureOutput = {
        tagsResult: {
          values: [
            { name: 'mango', confidence: 0.89 },
            { name: 'fruit', confidence: 0.92 }
          ]
        },
        denseCaptionsResult: {
          values: [
            { text: 'a ripe mango', confidence: 0.87 }
          ]
        },
        objectsResult: {
          values: []
        }
      }

      const result = pickBestOne(azureOutput)

      expect(result).toBe('mango')
    })
  })

  describe('Generic Filtering', () => {
    it('should filter out generic terms', () => {
      const azureOutput = {
        tagsResult: {
          values: [
            { name: 'chicken', confidence: 0.85 },
            { name: 'food', confidence: 0.95 },
            { name: 'meat', confidence: 0.88 },
            { name: 'animal', confidence: 0.82 }
          ]
        },
        denseCaptionsResult: {
          values: [
            { text: 'chicken on a plate', confidence: 0.80 }
          ]
        },
        objectsResult: {
          values: []
        }
      }

      const result = pickBestOne(azureOutput)

      expect(result).toBe('chicken')
      expect(result).not.toBe('food')
      expect(result).not.toBe('meat')
      expect(result).not.toBe('animal')
    })

    it('should filter out color and noise terms', () => {
      const azureOutput = {
        tagsResult: {
          values: [
            { name: 'tomato', confidence: 0.88 },
            { name: 'red', confidence: 0.92 },
            { name: 'close', confidence: 0.85 },
            { name: 'fresh', confidence: 0.79 }
          ]
        },
        denseCaptionsResult: {
          values: [
            { text: 'a red tomato closeup', confidence: 0.82 }
          ]
        },
        objectsResult: {
          values: []
        }
      }

      const result = pickBestOne(azureOutput)

      expect(result).toBe('tomato')
    })
  })

  describe('Seafood Disambiguation', () => {
    it('should distinguish shrimp from fish', () => {
      const azureOutput = {
        tagsResult: {
          values: [
            { name: 'shrimp', confidence: 0.82 },
            { name: 'fish', confidence: 0.75 },
            { name: 'seafood', confidence: 0.88 }
          ]
        },
        denseCaptionsResult: {
          values: [
            { text: 'shrimp on ice', confidence: 0.79 },
            { text: 'fresh shrimp', confidence: 0.81 }
          ]
        },
        objectsResult: {
          values: [
            {
              tags: [{ name: 'shrimp', confidence: 0.78 }],
              boundingBox: { x: 10, y: 10, w: 80, h: 80 }
            }
          ]
        }
      }

      const result = pickBestOne(azureOutput)

      expect(result).toBe('shrimp')
      expect(result).not.toBe('fish')
    })

    it('should distinguish octopus from fish', () => {
      const azureOutput = {
        tagsResult: {
          values: [
            { name: 'octopus', confidence: 0.79 },
            { name: 'fish', confidence: 0.68 }
          ]
        },
        denseCaptionsResult: {
          values: [
            { text: 'an octopus tentacle', confidence: 0.76 }
          ]
        },
        objectsResult: {
          values: [
            {
              tags: [{ name: 'octopus', confidence: 0.72 }],
              boundingBox: { x: 15, y: 15, w: 70, h: 70 }
            }
          ]
        }
      }

      const result = pickBestOne(azureOutput)

      expect(result).toBe('octopus')
    })
  })

  describe('Scoring Logic', () => {
    it('should prioritize high tag confidence', () => {
      const azureOutput = {
        tagsResult: {
          values: [
            { name: 'chicken', confidence: 0.95 },
            { name: 'turkey', confidence: 0.65 }
          ]
        },
        denseCaptionsResult: {
          values: [
            { text: 'poultry on a plate', confidence: 0.70 }
          ]
        },
        objectsResult: {
          values: []
        }
      }

      const result = pickBestOne(azureOutput)

      expect(result).toBe('chicken')
    })

    it('should consider caption frequency', () => {
      const azureOutput = {
        tagsResult: {
          values: [
            { name: 'tomato', confidence: 0.75 },
            { name: 'onion', confidence: 0.72 }
          ]
        },
        denseCaptionsResult: {
          values: [
            { text: 'a tomato on the counter', confidence: 0.80 },
            { text: 'red tomato closeup', confidence: 0.78 },
            { text: 'fresh tomato', confidence: 0.82 }
          ]
        },
        objectsResult: {
          values: []
        }
      }

      const result = pickBestOne(azureOutput)

      expect(result).toBe('tomato')
    })

    it('should value consistency across features', () => {
      const azureOutput = {
        tagsResult: {
          values: [
            { name: 'potato', confidence: 0.78 },
            { name: 'carrot', confidence: 0.80 }
          ]
        },
        denseCaptionsResult: {
          values: [
            { text: 'a potato on the table', confidence: 0.75 }
          ]
        },
        objectsResult: {
          values: [
            {
              tags: [{ name: 'potato', confidence: 0.72 }],
              boundingBox: { x: 10, y: 10, w: 80, h: 80 }
            }
          ]
        }
      }

      const result = pickBestOne(azureOutput)

      // Potato appears in all 3 features (tags, captions, objects)
      // Carrot only in tags
      expect(result).toBe('potato')
    })
  })

  describe('Tiebreaker Logic', () => {
    it('should use feature group count as tiebreaker', () => {
      const azureOutput = {
        tagsResult: {
          values: [
            { name: 'chicken', confidence: 0.75 },
            { name: 'beef', confidence: 0.74 }
          ]
        },
        denseCaptionsResult: {
          values: [
            { text: 'chicken on a plate', confidence: 0.70 }
          ]
        },
        objectsResult: {
          values: [
            {
              tags: [{ name: 'chicken', confidence: 0.68 }],
              boundingBox: { x: 10, y: 10, w: 80, h: 80 }
            }
          ]
        }
      }

      const result = pickBestOne(azureOutput)

      // Chicken in 3 groups, beef in 1 group
      expect(result).toBe('chicken')
    })
  })

  describe('Disqualification Rules', () => {
    it('should disqualify tokens only in captions', () => {
      const azureOutput = {
        tagsResult: {
          values: [
            { name: 'chicken', confidence: 0.85 }
          ]
        },
        denseCaptionsResult: {
          values: [
            { text: 'a fat chicken on the table', confidence: 0.80 }
          ]
        },
        objectsResult: {
          values: []
        }
      }

      const result = pickBestOne(azureOutput)

      // "fat" appears only in captions, should be disqualified
      expect(result).toBe('chicken')
      expect(result).not.toBe('fat')
    })

    it('should allow tokens in tags even without captions', () => {
      const azureOutput = {
        tagsResult: {
          values: [
            { name: 'milk', confidence: 0.92 }
          ]
        },
        denseCaptionsResult: {
          values: []
        },
        objectsResult: {
          values: []
        }
      }

      const result = pickBestOne(azureOutput)

      expect(result).toBe('milk')
    })

    it('should allow tokens in objects even without tags', () => {
      const azureOutput = {
        tagsResult: {
          values: []
        },
        denseCaptionsResult: {
          values: [
            { text: 'a pasta dish', confidence: 0.75 }
          ]
        },
        objectsResult: {
          values: [
            {
              tags: [{ name: 'pasta', confidence: 0.82 }],
              boundingBox: { x: 10, y: 10, w: 80, h: 80 }
            }
          ]
        }
      }

      const result = pickBestOne(azureOutput)

      expect(result).toBe('pasta')
    })
  })

  describe('Singularization', () => {
    it('should singularize tomatoes to tomato', () => {
      const azureOutput = {
        tagsResult: {
          values: [
            { name: 'tomatoes', confidence: 0.88 }
          ]
        },
        denseCaptionsResult: {
          values: [
            { text: 'red tomatoes', confidence: 0.82 }
          ]
        },
        objectsResult: {
          values: []
        }
      }

      const result = pickBestOne(azureOutput)

      expect(result).toBe('tomato')
    })

    it('should singularize shrimps to shrimp', () => {
      const azureOutput = {
        tagsResult: {
          values: [
            { name: 'shrimps', confidence: 0.85 }
          ]
        },
        denseCaptionsResult: {
          values: [
            { text: 'fresh shrimps', confidence: 0.79 }
          ]
        },
        objectsResult: {
          values: []
        }
      }

      const result = pickBestOne(azureOutput)

      expect(result).toBe('shrimp')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty input', () => {
      const azureOutput = {
        tagsResult: { values: [] },
        denseCaptionsResult: { values: [] },
        objectsResult: { values: [] }
      }

      const result = pickBestOne(azureOutput)

      expect(result).toBeNull()
    })

    it('should handle only generic terms', () => {
      const azureOutput = {
        tagsResult: {
          values: [
            { name: 'food', confidence: 0.95 },
            { name: 'produce', confidence: 0.88 },
            { name: 'meat', confidence: 0.82 }
          ]
        },
        denseCaptionsResult: {
          values: [
            { text: 'food on a plate', confidence: 0.80 }
          ]
        },
        objectsResult: {
          values: []
        }
      }

      const result = pickBestOne(azureOutput)

      expect(result).toBeNull()
    })

    it('should handle missing fields', () => {
      const azureOutput = {}

      const result = pickBestOne(azureOutput)

      expect(result).toBeNull()
    })

    it('should handle very short tokens', () => {
      const azureOutput = {
        tagsResult: {
          values: [
            { name: 'ab', confidence: 0.90 },
            { name: 'chicken', confidence: 0.85 }
          ]
        },
        denseCaptionsResult: {
          values: []
        },
        objectsResult: {
          values: []
        }
      }

      const result = pickBestOne(azureOutput)

      // "ab" should be filtered (< 3 chars)
      expect(result).toBe('chicken')
    })
  })

  describe('Real-World Scenarios', () => {
    it('should handle pile of mangos', () => {
      const azureOutput = {
        tagsResult: {
          values: [
            { name: 'mangoes', confidence: 0.87 },
            { name: 'fruit', confidence: 0.92 }
          ]
        },
        denseCaptionsResult: {
          values: [
            { text: 'a pile of mangoes', confidence: 0.85 },
            { text: 'fresh mangoes on display', confidence: 0.83 }
          ]
        },
        objectsResult: {
          values: [
            {
              tags: [{ name: 'mango', confidence: 0.82 }],
              boundingBox: { x: 10, y: 10, w: 30, h: 30 }
            }
          ]
        }
      }

      const result = pickBestOne(azureOutput)

      expect(result).toBe('mango')
    })

    it('should handle goat meat', () => {
      const azureOutput = {
        tagsResult: {
          values: [
            { name: 'goat', confidence: 0.74 },
            { name: 'meat', confidence: 0.86 }
          ]
        },
        denseCaptionsResult: {
          values: [
            { text: 'goat meat pieces', confidence: 0.72 }
          ]
        },
        objectsResult: {
          values: [
            {
              tags: [{ name: 'goat', confidence: 0.68 }],
              boundingBox: { x: 5, y: 5, w: 90, h: 90 }
            }
          ]
        }
      }

      const result = pickBestOne(azureOutput)

      expect(result).toBe('goat')
    })

    it('should handle pasta (not potato)', () => {
      const azureOutput = {
        tagsResult: {
          values: [
            { name: 'pasta', confidence: 0.82 }
          ]
        },
        denseCaptionsResult: {
          values: [
            { text: 'pasta in a bowl', confidence: 0.79 }
          ]
        },
        objectsResult: {
          values: []
        }
      }

      const result = pickBestOne(azureOutput)

      expect(result).toBe('pasta')
      expect(result).not.toBe('potato')
    })
  })
})


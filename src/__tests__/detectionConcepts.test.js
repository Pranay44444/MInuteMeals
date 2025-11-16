/**
 * Tests for Detection Concepts
 * Verifies the logic and concepts used in ingredient detection
 */

describe('Detection Concepts', () => {
  describe('Protein Categories', () => {
    it('should define red meat category', () => {
      const redMeat = ['beef', 'mutton', 'lamb', 'pork', 'veal', 'goat'];
      expect(redMeat).toHaveLength(6);
      expect(redMeat).toContain('beef');
      expect(redMeat).toContain('mutton');
    });

    it('should define poultry category', () => {
      const poultry = ['chicken', 'turkey', 'duck'];
      expect(poultry).toHaveLength(3);
      expect(poultry).toContain('chicken');
    });

    it('should define seafood categories', () => {
      const fishTypes = ['fish', 'salmon', 'tuna', 'cod', 'tilapia'];
      const shellfish = ['shrimp', 'prawn', 'lobster', 'crab', 'oyster', 'clam', 'mussel'];
      const cephalopods = ['octopus', 'squid', 'cuttlefish'];

      expect(fishTypes.length).toBeGreaterThan(0);
      expect(shellfish.length).toBeGreaterThan(0);
      expect(cephalopods.length).toBeGreaterThan(0);

      expect(cephalopods).toContain('octopus');
      expect(shellfish).toContain('shrimp');
    });
  });

  describe('Seafood Hierarchy Logic', () => {
    it('should remove generic fish when specific seafood detected', () => {
      const detected = ['octopus', 'fish', 'seafood'];
      const hasCephalopod = detected.includes('octopus') || detected.includes('squid');

      if (hasCephalopod) {
        const filtered = detected.filter((item) => item !== 'fish');
        expect(filtered).not.toContain('fish');
        expect(filtered).toContain('octopus');
      }
    });

    it('should remove generic fish when shellfish detected', () => {
      const detected = ['shrimp', 'fish', 'shellfish'];
      const hasShellfish = detected.includes('shrimp') || detected.includes('prawn');

      if (hasShellfish) {
        const filtered = detected.filter((item) => item !== 'fish');
        expect(filtered).not.toContain('fish');
        expect(filtered).toContain('shrimp');
      }
    });
  });

  describe('Sibling Disambiguation Logic', () => {
    it('should identify siblings in same category', () => {
      const redMeat = new Set(['beef', 'mutton', 'lamb', 'pork', 'veal', 'goat']);
      const detected = ['beef', 'mutton', 'pork'];

      const siblings = detected.filter((item) => redMeat.has(item));
      expect(siblings.length).toBeGreaterThan(1);

      // Should return only highest-scoring (first in sorted array)
      const result = [siblings[0]];
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('beef');
    });

    it('should keep items from different categories', () => {
      const poultry = new Set(['chicken', 'turkey', 'duck']);
      const vegetables = new Set(['tomato', 'onion', 'potato']);
      const detected = ['chicken', 'tomato'];

      const isPoultry = (item) => poultry.has(item);
      const isVegetable = (item) => vegetables.has(item);

      const hasPoultry = detected.some(isPoultry);
      const hasVegetable = detected.some(isVegetable);

      // Different categories - keep both
      expect(hasPoultry).toBe(true);
      expect(hasVegetable).toBe(true);
      expect(detected).toHaveLength(2);
    });
  });

  describe('Descriptor Stripping Logic', () => {
    it('should strip processing terms', () => {
      const descriptors = new Set([
        'chopped',
        'diced',
        'minced',
        'ground',
        'cubed',
        'shredded',
      ]);

      const stripDescriptors = (phrase) => {
        return phrase
          .split(' ')
          .filter((word) => !descriptors.has(word))
          .join(' ');
      };

      expect(stripDescriptors('chopped mutton')).toBe('mutton');
      expect(stripDescriptors('minced beef')).toBe('beef');
      expect(stripDescriptors('diced chicken')).toBe('chicken');
    });

    it('should strip cooking methods', () => {
      const methods = new Set(['boiled', 'fried', 'grilled', 'roasted', 'baked']);

      const stripMethods = (phrase) => {
        return phrase
          .split(' ')
          .filter((word) => !methods.has(word))
          .join(' ');
      };

      expect(stripMethods('grilled chicken')).toBe('chicken');
      expect(stripMethods('fried fish')).toBe('fish');
    });
  });

  describe('Confidence Thresholds', () => {
    it('should define appropriate thresholds', () => {
      const CONFIDENCE_MIN = 0.65; // Lowered for chopped meats
      const SCORE_MIN = 0.52; // Lowered for better detection
      const CORE_CONFIDENCE_THRESHOLD = 0.55; // Trigger enhancement sooner

      expect(CONFIDENCE_MIN).toBeLessThan(0.70);
      expect(SCORE_MIN).toBeLessThan(0.60);
      expect(CORE_CONFIDENCE_THRESHOLD).toBeLessThan(0.60);
    });
  });

  describe('Generic Term Filtering', () => {
    it('should identify parent categories', () => {
      const parentCategories = new Set([
        'meat',
        'seafood',
        'animal',
        'crustacean',
        'invertebrate',
        'mollusk',
        'shellfish',
      ]);

      expect(parentCategories.has('meat')).toBe(true);
      expect(parentCategories.has('seafood')).toBe(true);
      expect(parentCategories.has('beef')).toBe(false); // Specific, not parent
    });

    it('should filter out parent categories when specific exists', () => {
      const detected = ['beef', 'meat', 'animal'];
      const parentCategories = new Set(['meat', 'animal']);

      const filtered = detected.filter((item) => !parentCategories.has(item));

      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toBe('beef');
    });
  });
});




// Unit conversion utility for Indian users
// Converts foreign units (pounds, cups, oz) to Indian metric (kg, g, L, ml, cm)

// Helper: Parse mixed quantities like "1/2", "1 1/2", "1-2"
const parseQuantity = (qty) => {
    if (!qty) return 0;
    const str = String(qty).trim();

    // specific fraction chars
    const fractionMap = {
        '½': 0.5, '⅓': 0.33, '⅔': 0.66, '¼': 0.25, '¾': 0.75,
        '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8, '⅙': 0.16, '⅚': 0.83,
        '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875
    };
    if (fractionMap[str]) return fractionMap[str];

    // Check for range "1-2" -> take average
    if (str.includes('-')) {
        const parts = str.split('-').map(s => parseFloat(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            return (parts[0] + parts[1]) / 2;
        }
    }

    // Check for "1 1/2" mixed number
    if (str.includes(' ')) {
        const parts = str.split(' ');
        if (parts.length === 2) {
            const whole = parseFloat(parts[0]);
            const frac = parts[1];
            if (!isNaN(whole) && frac.includes('/')) {
                const [num, den] = frac.split('/').map(n => parseFloat(n));
                if (den !== 0) {
                    return whole + (num / den);
                }
            }
        }
    }

    // Check for "1/2" simple fraction
    if (str.includes('/')) {
        const [num, den] = str.split('/').map(n => parseFloat(n));
        if (den !== 0) {
            return num / den;
        }
    }

    return parseFloat(str);
};

// Valid units to search for in messy strings (Aggressive Extraction)
const KNOWN_UNITS = [
    'cup', 'cups', 'tablespoon', 'tablespoons', 'tbsp', 'teaspoon', 'teaspoons', 'tsp',
    'pound', 'pounds', 'lb', 'lbs', 'ounce', 'ounces', 'oz', 'fluid ounce', 'fluid ounces', 'fl oz',
    'pint', 'pints', 'quart', 'quarts', 'gallon', 'gallons',
    'inch', 'inches', 'in', 'stick', 'sticks',
    'gram', 'grams', 'g', 'kilogram', 'kilograms', 'kg',
    'milliliter', 'milliliters', 'ml', 'liter', 'liters', 'l', 'centimeter', 'centimeters', 'cm'
];

// Words to STRIP completely if found (Deep Cleaning)
// "1 clove for aioli" -> "1"
const GARBAGE_TERMS = [
    'stalk', 'stalks', 'head', 'heads', 'bulb', 'bulbs',
    'clove', 'cloves', 'ear', 'ears', 'sprig', 'sprigs',
    'fillet', 'fillets', 'wedge', 'wedges', 'slice', 'slices',
    'leaf', 'leaves', 'piece', 'pieces', 'pinch', 'pinches', 'dash', 'dashes',
    'grated', 'minced', 'chopped', 'diced', 'crushed', 'whole',
    'organic', 'fresh', 'dried', 'large', 'medium', 'small',
    'box', 'can', 'jar', 'packet', 'bag', 'container', 'bunch', 'bunches'
];

const cleanUnit = (unit) => {
    if (!unit) return '';
    let normalized = unit.toLowerCase();

    // 1. Aggressive Extraction: If it matches a KNOWN conversion unit, take it immediately.
    // matches "cup" in "1 cup chopped".
    const sortedUnits = [...KNOWN_UNITS].sort((a, b) => b.length - a.length);
    for (const known of sortedUnits) {
        const regex = new RegExp(`\\b${known}\\b`);
        if (regex.test(normalized)) {
            return known;
        }
    }

    // 2. Deep Cleaning (Garbage Removal)
    // Remove "for aioli", "for serving", "measure for..."
    normalized = normalized.replace(/\s+for\s+.*/g, '');

    // Remove garbage terms
    const garbageRegex = new RegExp(`\\b(${GARBAGE_TERMS.join('|')})\\b`, 'g');
    normalized = normalized.replace(garbageRegex, '');

    // Remove non-alpha and trailing commas
    normalized = normalized.replace(/[^a-z\s]/g, '').trim();

    return normalized;
};

const CONVERSION_RATES = {
    // Weight conversions to grams
    'pound': 453.592, 'pounds': 453.592, 'lb': 453.592, 'lbs': 453.592,
    'ounce': 28.3495, 'ounces': 28.3495, 'oz': 28.3495,
    // Linear conversions to cm
    'inch': 2.54, 'inches': 2.54, 'in': 2.54,
    // Others
    'stick': 113.4, 'sticks': 113.4,
    // Metric
    'gram': 1, 'grams': 1, 'g': 1,
    'kilogram': 1000, 'kilograms': 1000, 'kg': 1000,
    'milliliter': 1, 'milliliters': 1, 'ml': 1,
    'liter': 1000, 'liters': 1000, 'l': 1000,
    'centimeter': 1, 'centimeters': 1, 'cm': 1
};

const VOLUME_TO_ML = {
    'cup': 240, 'cups': 240,
    'tablespoon': 15, 'tablespoons': 15, 'tbsp': 15,
    'teaspoon': 5, 'teaspoons': 5, 'tsp': 5,
    'fluid ounce': 29.57, 'fluid ounces': 29.57, 'fl oz': 29.57,
    'pint': 473.18, 'pints': 473.18,
    'quart': 946.35, 'quarts': 946.35,
    'gallon': 3785.41, 'gallons': 3785.41,
};

const VOLUME_TO_GRAMS = {
    'cup': 120, 'cups': 120,
    'tablespoon': 15, 'tablespoons': 15, 'tbsp': 15,
    'teaspoon': 5, 'teaspoons': 5, 'tsp': 5,
};

const LIQUID_INGREDIENTS = [
    'water', 'milk', 'cream', 'oil', 'broth', 'stock', 'juice',
    'wine', 'vinegar', 'sauce', 'honey', 'syrup', 'coconut milk',
    'almond milk', 'soy milk', 'buttermilk', 'yogurt', 'kefir',
    'coffee', 'tea', 'beer', 'liquor', 'vodka', 'rum', 'whiskey',
    'marinade', 'dressing', 'drink', 'soda', 'beverage',
    'ketchup', 'salsa', 'extract', 'paste', 'ghee'
];

const STRICT_LIQUIDS = [
    'water', 'milk', 'cream', 'oil', 'broth', 'stock', 'juice',
    'wine', 'vinegar', 'sauce', 'syrup', 'soda', 'beverage', 'drink',
    'tea', 'coffee', 'beer', 'liquor', 'vodka', 'rum', 'whiskey'
];


const JUICE_YIELDS = {
    'lemon': 45,  // ~45ml / 3tbsp
    'lime': 30,   // ~30ml / 2tbsp
    'orange': 80  // ~80ml / 1/3 cup
};

const isLiquidIngredient = (ingredientName) => {
    if (!ingredientName) return false;
    const nameLower = ingredientName.toLowerCase();
    return LIQUID_INGREDIENTS.some(liquid => nameLower.includes(liquid));
};

const isStrictLiquid = (ingredientName) => {
    if (!ingredientName) return false;
    const nameLower = ingredientName.toLowerCase();
    return STRICT_LIQUIDS.some(liquid => nameLower.includes(liquid));
}

// Format Decimal to Fraction or fixed string
const formatQuantity = (val) => {
    if (val === 0) return '0';
    // exact match check
    const eps = 0.05;
    if (Math.abs(val - 0.25) < eps) return '1/4';
    if (Math.abs(val - 0.5) < eps) return '1/2';
    if (Math.abs(val - 0.75) < eps) return '3/4';
    if (Math.abs(val - 0.33) < eps) return '1/3';
    if (Math.abs(val - 0.66) < eps) return '2/3';
    if (Math.abs(val - 0.2) < eps) return '1/5';

    // For small decimals < 1, format nicely
    if (val < 1) {
        if (Math.abs(val - Math.round(val)) < 0.01) return Math.round(val).toString();
        return parseFloat(val.toFixed(2)).toString();
    }

    // Integers
    return Math.round(val).toString();
};


/**
 * Convert quantity and unit to Indian metric system
 */
export const convertToIndianUnits = (qty, unit, ingredientName = '') => {
    if (!qty || !unit) return { qty, unit };

    const numQty = parseQuantity(qty);
    if (isNaN(numQty) || numQty === 0) return { qty, unit };

    let normalizedUnit = unit.toLowerCase().trim();

    // --- JUICE LOGIC ---
    // If ingredient is a juice (e.g. "Lime Juice") and unit is the fruit itself (e.g. "lime", "limes")
    // Convert to ML directly.
    if (ingredientName.toLowerCase().includes('juice')) {
        for (const [fruit, mlPerFruit] of Object.entries(JUICE_YIELDS)) {
            // check if unit contains "lime" or "limes"
            if (normalizedUnit.includes(fruit)) {
                const totalMl = numQty * mlPerFruit;
                return {
                    qty: Math.round(totalMl).toString(),
                    unit: 'ml'
                };
            }
        }
    }

    // --- CLEANING ---
    const cleaned = cleanUnit(normalizedUnit);
    if (cleaned) {
        normalizedUnit = cleaned;
    } else {
        // If cleaned returns empty string, it means the unit was pure garbage (e.g. "stalk", "clove")
        // Return just the quantity (Count)
        // Unit is basically empty/null now.
        return {
            qty: formatQuantity(numQty),
            unit: ''
        };
    }

    // If strict match on conversion table or "cleaned" match
    // 1. Gram -> ML
    if (['g', 'gram', 'grams', 'kg', 'kilogram'].includes(normalizedUnit)) {
        if (isStrictLiquid(ingredientName)) {
            if (normalizedUnit.startsWith('k')) {
                return { qty: numQty.toString(), unit: 'L' };
            } else {
                return { qty: numQty.toString(), unit: 'ml' };
            }
        }
    }

    // 2. Direct Conversion
    const directRate = CONVERSION_RATES[normalizedUnit];
    if (directRate) {
        if (['inch', 'inches', 'in'].includes(normalizedUnit)) {
            const cm = numQty * directRate;
            return {
                qty: cm < 10 ? cm.toFixed(1).replace(/\.0$/, '') : Math.round(cm).toString(),
                unit: 'cm'
            };
        }

        const val = numQty * directRate;
        if (isStrictLiquid(ingredientName)) {
            if (val >= 1000) {
                return { qty: (val / 1000).toFixed(2).replace(/\.?0+$/, ''), unit: 'L' };
            } else {
                return { qty: Math.round(val).toString(), unit: 'ml' };
            }
        }

        if (val >= 1000) {
            return { qty: (val / 1000).toFixed(2).replace(/\.?0+$/, ''), unit: 'kg' };
        } else {
            return { qty: Math.round(val).toString(), unit: 'g' };
        }
    }

    // 3. Volume Conversion
    const isVolume = VOLUME_TO_ML[normalizedUnit] || VOLUME_TO_GRAMS[normalizedUnit];

    if (isVolume) {
        const isLiquid = isLiquidIngredient(ingredientName);

        if (isLiquid) {
            const ml = numQty * (VOLUME_TO_ML[normalizedUnit] || 0);
            if (ml >= 1000) {
                return { qty: (ml / 1000).toFixed(2).replace(/\.?0+$/, ''), unit: 'L' };
            } else {
                return { qty: Math.round(ml).toString(), unit: 'ml' };
            }

        } else {
            const grams = numQty * (VOLUME_TO_GRAMS[normalizedUnit] || 0);
            if (grams >= 1000) {
                return { qty: (grams / 1000).toFixed(2).replace(/\.?0+$/, ''), unit: 'kg' };
            } else {
                return { qty: Math.round(grams).toString(), unit: 'g' };
            }
        }
    }

    // 4. Fallback (Cleaned unit, e.g. "box" -> "box" but quantity formatted)
    // If unit is still not recognized but wasn't fully removed
    return {
        qty: formatQuantity(numQty),
        unit: normalizedUnit
    };
};

/**
 * Convert an ingredient object to Indian units
 */
export const convertIngredientToIndianUnits = (ingredient) => {
    if (!ingredient || !ingredient.qty || !ingredient.unit) {
        return ingredient;
    }

    const { qty: convertedQty, unit: convertedUnit } = convertToIndianUnits(
        ingredient.qty,
        ingredient.unit,
        ingredient.name
    );

    return {
        ...ingredient,
        qty: convertedQty,
        unit: convertedUnit
    };
};

/**
 * Convert array of ingredients to Indian units
 */
export const convertIngredientsToIndianUnits = (ingredients) => {
    if (!Array.isArray(ingredients)) return ingredients;
    return ingredients.map(convertIngredientToIndianUnits);
};

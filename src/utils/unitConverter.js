// Unit conversion utility for Indian users
// Converts foreign units (pounds, cups, oz) to Indian metric (kg, g, L, ml)

const CONVERSION_RATES = {
    // Weight conversions to grams
    'pound': 453.592,
    'pounds': 453.592,
    'lb': 453.592,
    'lbs': 453.592,
    'ounce': 28.3495,
    'ounces': 28.3495,
    'oz': 28.3495,

    // Already metric - no conversion needed
    'gram': 1,
    'grams': 1,
    'g': 1,
    'kilogram': 1000,
    'kilograms': 1000,
    'kg': 1000,
    'milliliter': 1,
    'milliliters': 1,
    'ml': 1,
    'liter': 1000,
    'liters': 1000,
    'l': 1000,
}

// Volume to ML (for liquids)
const VOLUME_TO_ML = {
    'cup': 240,
    'cups': 240,
    'tablespoon': 15,
    'tablespoons': 15,
    'tbsp': 15,
    'teaspoon': 5,
    'teaspoons': 5,
    'tsp': 5,
    'fluid ounce': 29.5735,
    'fluid ounces': 29.5735,
    'fl oz': 29.5735,
    'pint': 473.176,
    'pints': 473.176,
    'quart': 946.353,
    'quarts': 946.353,
    'gallon': 3785.41,
    'gallons': 3785.41,
}

// Volume to grams (for solid ingredients - approximate)
const VOLUME_TO_GRAMS = {
    'cup': 120,  // Average for flour, sugar, etc.
    'cups': 120,
    'tablespoon': 15,  // ~15g for most solids
    'tablespoons': 15,
    'tbsp': 15,
    'teaspoon': 5,  // ~5g for most solids
    'teaspoons': 5,
    'tsp': 5,
}

// List of liquid ingredients (case-insensitive keywords)
const LIQUID_INGREDIENTS = [
    'water', 'milk', 'cream', 'oil', 'broth', 'stock', 'juice',
    'wine', 'vinegar', 'sauce', 'honey', 'syrup', 'coconut milk',
    'almond milk', 'soy milk', 'buttermilk', 'yogurt', 'kefir',
    'coffee', 'tea', 'beer', 'liquor', 'vodka', 'rum', 'whiskey',
    'marinade', 'dressing', 'liquid', 'beverage', 'drink'
]

/**
 * Check if ingredient is a liquid based on name
 * @param {string} ingredientName - Name of the ingredient
 * @returns {boolean} - True if liquid, false if solid
 */
const isLiquidIngredient = (ingredientName) => {
    if (!ingredientName) return false
    const nameLower = ingredientName.toLowerCase()
    return LIQUID_INGREDIENTS.some(liquid => nameLower.includes(liquid))
}

/**
 * Convert quantity and unit to Indian metric system
 * @param {string|number} qty - The quantity (e.g., "1.5", "2")
 * @param {string} unit - The unit (e.g., "pounds", "cups")
 * @param {string} ingredientName - The ingredient name (to detect liquid vs solid)
 * @returns {Object} - { qty: convertedQty, unit: metricUnit }
 */
export const convertToIndianUnits = (qty, unit, ingredientName = '') => {
    // Handle empty or invalid inputs
    if (!qty || !unit) {
        return { qty, unit }
    }

    // Parse quantity to number
    const numQty = parseFloat(qty)
    if (isNaN(numQty)) {
        return { qty, unit }
    }

    // Normalize unit (lowercase, trim)
    const normalizedUnit = unit.toLowerCase().trim()

    // Check if it's a direct weight conversion
    const weightConversion = CONVERSION_RATES[normalizedUnit]
    if (weightConversion) {
        const grams = numQty * weightConversion

        if (grams >= 1000) {
            return {
                qty: (grams / 1000).toFixed(2).replace(/\.?0+$/, ''),
                unit: 'kg'
            }
        } else {
            return {
                qty: Math.round(grams).toString(),
                unit: 'g'
            }
        }
    }

    // Check if it's a volume unit (cups, tbsp, tsp, etc.)
    const isVolumeUnit = VOLUME_TO_ML[normalizedUnit] || VOLUME_TO_GRAMS[normalizedUnit]

    if (isVolumeUnit) {
        const isLiquid = isLiquidIngredient(ingredientName)

        if (isLiquid) {
            // Convert to ml/L for liquids
            const ml = numQty * (VOLUME_TO_ML[normalizedUnit] || 0)

            if (ml >= 1000) {
                return {
                    qty: (ml / 1000).toFixed(2).replace(/\.?0+$/, ''),
                    unit: 'L'
                }
            } else {
                return {
                    qty: Math.round(ml).toString(),
                    unit: 'ml'
                }
            }
        } else {
            // Convert to g/kg for solids
            const grams = numQty * (VOLUME_TO_GRAMS[normalizedUnit] || 0)

            if (grams >= 1000) {
                return {
                    qty: (grams / 1000).toFixed(2).replace(/\.?0+$/, ''),
                    unit: 'kg'
                }
            } else {
                return {
                    qty: Math.round(grams).toString(),
                    unit: 'g'
                }
            }
        }
    }

    // If not in conversion table, return as-is
    return { qty, unit }
}

/**
 * Convert an ingredient object to Indian units
 * @param {Object} ingredient - { name, qty, unit, ...otherProps }
 * @returns {Object} - ingredient with converted qty and unit
 */
export const convertIngredientToIndianUnits = (ingredient) => {
    if (!ingredient || !ingredient.qty || !ingredient.unit) {
        return ingredient
    }

    const { qty: convertedQty, unit: convertedUnit } = convertToIndianUnits(
        ingredient.qty,
        ingredient.unit,
        ingredient.name  // Pass ingredient name for liquid detection
    )

    return {
        ...ingredient,
        qty: convertedQty,
        unit: convertedUnit
    }
}

/**
 * Convert array of ingredients to Indian units
 * @param {Array} ingredients - Array of ingredient objects
 * @returns {Array} - Array of ingredients with converted units
 */
export const convertIngredientsToIndianUnits = (ingredients) => {
    if (!Array.isArray(ingredients)) {
        return ingredients
    }

    return ingredients.map(convertIngredientToIndianUnits)
}

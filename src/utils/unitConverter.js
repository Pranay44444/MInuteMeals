const parseQty = (qty) => {
    if (!qty) return 0
    const str = String(qty).trim()
    const fracs = { '½': 0.5, '⅓': 0.33, '⅔': 0.66, '¼': 0.25, '¾': 0.75, '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8, '⅙': 0.16, '⅚': 0.83, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 }
    if (fracs[str]) return fracs[str]
    if (str.includes('-')) {
        const parts = str.split('-').map(s => parseFloat(s.trim()))
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return (parts[0] + parts[1]) / 2
    }
    if (str.includes(' ')) {
        const parts = str.split(' ')
        if (parts.length === 2) {
            const whole = parseFloat(parts[0])
            const frac = parts[1]
            if (!isNaN(whole) && frac.includes('/')) {
                const [num, den] = frac.split('/').map(n => parseFloat(n))
                if (den !== 0) return whole + (num / den)
            }
        }
    }
    if (str.includes('/')) {
        const [num, den] = str.split('/').map(n => parseFloat(n))
        if (den !== 0) return num / den
    }
    return parseFloat(str)
}

const UNITS = [
    'cup', 'cups', 'tablespoon', 'tablespoons', 'tbsp', 'teaspoon', 'teaspoons', 'tsp',
    'pound', 'pounds', 'lb', 'lbs', 'ounce', 'ounces', 'oz', 'fluid ounce', 'fluid ounces', 'fl oz',
    'pint', 'pints', 'quart', 'quarts', 'gallon', 'gallons',
    'inch', 'inches', 'in', 'stick', 'sticks',
    'gram', 'grams', 'g', 'kilogram', 'kilograms', 'kg',
    'milliliter', 'milliliters', 'ml', 'liter', 'liters', 'l', 'centimeter', 'centimeters', 'cm'
]

const GARBAGE = [
    'stalk', 'stalks', 'head', 'heads', 'bulb', 'bulbs', 'clove', 'cloves', 'ear', 'ears', 'sprig', 'sprigs',
    'fillet', 'fillets', 'wedge', 'wedges', 'slice', 'slices', 'leaf', 'leaves', 'piece', 'pieces', 'pinch', 'pinches', 'dash', 'dashes',
    'grated', 'minced', 'chopped', 'diced', 'crushed', 'whole', 'organic', 'fresh', 'dried', 'large', 'medium', 'small',
    'box', 'can', 'jar', 'packet', 'bag', 'container', 'bunch', 'bunches'
]

const cleanUnit = (unit) => {
    if (!unit) return ''
    let norm = unit.toLowerCase()
    const sorted = [...UNITS].sort((a, b) => b.length - a.length)
    for (const known of sorted) {
        if (new RegExp(`\\b${known}\\b`).test(norm)) return known
    }
    norm = norm.replace(/\s+for\s+.*/g, '')
    norm = norm.replace(new RegExp(`\\b(${GARBAGE.join('|')})\\b`, 'g'), '')
    norm = norm.replace(/[^a-z\s]/g, '').trim()
    return norm
}

const RATES = {
    'pound': 453.592, 'pounds': 453.592, 'lb': 453.592, 'lbs': 453.592,
    'ounce': 28.3495, 'ounces': 28.3495, 'oz': 28.3495,
    'inch': 2.54, 'inches': 2.54, 'in': 2.54,
    'stick': 113.4, 'sticks': 113.4,
    'gram': 1, 'grams': 1, 'g': 1,
    'kilogram': 1000, 'kilograms': 1000, 'kg': 1000,
    'milliliter': 1, 'milliliters': 1, 'ml': 1,
    'liter': 1000, 'liters': 1000, 'l': 1000,
    'centimeter': 1, 'centimeters': 1, 'cm': 1
}

const VOL_ML = {
    'cup': 240, 'cups': 240,
    'tablespoon': 15, 'tablespoons': 15, 'tbsp': 15,
    'teaspoon': 5, 'teaspoons': 5, 'tsp': 5,
    'fluid ounce': 29.57, 'fluid ounces': 29.57, 'fl oz': 29.57,
    'pint': 473.18, 'pints': 473.18,
    'quart': 946.35, 'quarts': 946.35,
    'gallon': 3785.41, 'gallons': 3785.41
}

const VOL_G = {
    'cup': 120, 'cups': 120,
    'tablespoon': 15, 'tablespoons': 15, 'tbsp': 15,
    'teaspoon': 5, 'teaspoons': 5, 'tsp': 5
}

const LIQUIDS = ['water', 'milk', 'cream', 'oil', 'broth', 'stock', 'juice', 'wine', 'vinegar', 'sauce', 'honey', 'syrup', 'coconut milk', 'almond milk', 'soy milk', 'buttermilk', 'yogurt', 'kefir', 'coffee', 'tea', 'beer', 'liquor', 'vodka', 'rum', 'whiskey', 'marinade', 'dressing', 'drink', 'soda', 'beverage', 'ketchup', 'salsa', 'extract', 'paste', 'ghee']
const STRICT_LIQUIDS = ['water', 'milk', 'cream', 'oil', 'broth', 'stock', 'juice', 'wine', 'vinegar', 'sauce', 'syrup', 'soda', 'beverage', 'drink', 'tea', 'coffee', 'beer', 'liquor', 'vodka', 'rum', 'whiskey']
const JUICE_ML = { 'lemon': 45, 'lime': 30, 'orange': 80 }

const isLiquid = (name) => name ? LIQUIDS.some(l => name.toLowerCase().includes(l)) : false
const isStrict = (name) => name ? STRICT_LIQUIDS.some(l => name.toLowerCase().includes(l)) : false

const formatQty = (val) => {
    if (val === 0) return '0'
    const eps = 0.05
    if (Math.abs(val - 0.25) < eps) return '1/4'
    if (Math.abs(val - 0.5) < eps) return '1/2'
    if (Math.abs(val - 0.75) < eps) return '3/4'
    if (Math.abs(val - 0.33) < eps) return '1/3'
    if (Math.abs(val - 0.66) < eps) return '2/3'
    if (Math.abs(val - 0.2) < eps) return '1/5'
    if (val < 1) {
        if (Math.abs(val - Math.round(val)) < 0.01) return Math.round(val).toString()
        return parseFloat(val.toFixed(2)).toString()
    }
    return Math.round(val).toString()
}

export const convertToIndianUnits = (qty, unit, name = '') => {
    if (!qty || !unit) return { qty, unit }
    const num = parseQty(qty)
    if (isNaN(num) || num === 0) return { qty, unit }
    let norm = unit.toLowerCase().trim()

    if (name.toLowerCase().includes('juice')) {
        for (const [fruit, ml] of Object.entries(JUICE_ML)) {
            if (norm.includes(fruit)) return { qty: Math.round(num * ml).toString(), unit: 'ml' }
        }
    }

    const cleaned = cleanUnit(norm)
    if (cleaned) norm = cleaned
    else return { qty: formatQty(num), unit: '' }

    if (['g', 'gram', 'grams', 'kg', 'kilogram'].includes(norm)) {
        if (isStrict(name)) return { qty: num.toString(), unit: norm.startsWith('k') ? 'L' : 'ml' }
    }

    const rate = RATES[norm]
    if (rate) {
        if (['inch', 'inches', 'in'].includes(norm)) {
            const cm = num * rate
            return { qty: cm < 10 ? cm.toFixed(1).replace(/\.0$/, '') : Math.round(cm).toString(), unit: 'cm' }
        }
        const val = num * rate
        if (isStrict(name)) {
            return val >= 1000 ? { qty: (val / 1000).toFixed(2).replace(/\.?0+$/, ''), unit: 'L' } : { qty: Math.round(val).toString(), unit: 'ml' }
        }
        return val >= 1000 ? { qty: (val / 1000).toFixed(2).replace(/\.?0+$/, ''), unit: 'kg' } : { qty: Math.round(val).toString(), unit: 'g' }
    }

    const isVol = VOL_ML[norm] || VOL_G[norm]
    if (isVol) {
        if (isLiquid(name)) {
            const ml = num * (VOL_ML[norm] || 0)
            return ml >= 1000 ? { qty: (ml / 1000).toFixed(2).replace(/\.?0+$/, ''), unit: 'L' } : { qty: Math.round(ml).toString(), unit: 'ml' }
        } else {
            const g = num * (VOL_G[norm] || 0)
            return g >= 1000 ? { qty: (g / 1000).toFixed(2).replace(/\.?0+$/, ''), unit: 'kg' } : { qty: Math.round(g).toString(), unit: 'g' }
        }
    }

    return { qty: formatQty(num), unit: norm }
}

export const convertIngredientToIndianUnits = (ing) => {
    if (!ing || !ing.qty || !ing.unit) return ing
    const { qty, unit } = convertToIndianUnits(ing.qty, ing.unit, ing.name)
    return { ...ing, qty, unit }
}

export const convertIngredientsToIndianUnits = (ings) => {
    if (!Array.isArray(ings)) return ings
    return ings.map(convertIngredientToIndianUnits)
}

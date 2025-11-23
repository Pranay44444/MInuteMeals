/**
 * Robust Ingredient Detector
 *
 * Hybrid pipeline with core detection + enhancement layer:
 *
 * Stage 1: Core detection (existing logic, unchanged baseline)
 * Stage 2: Enhancement layer (validation + correction wrapper)
 * Stage 3: Fallback guard (last-resort for empty results)
 */
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { resolveNonVeg } from './resolveNonVeg';
// ==================== CONFIGURATION ====================
// Generic terms to drop (noise)
const GENERIC = new Set([
    'food', 'produce', 'fruit', 'vegetable', 'dairy', 'drink', 'beverage',
    'animal', 'meat', 'seafood', 'invertebrate', 'crustacean',
    'whole food', 'natural foods', 'local food', 'vegan nutrition',
    'vegetarian food', 'superfood'
]);
// Descriptors to strip (including processing terms for better meat detection)
const DESCRIPTORS = new Set([
    // Freshness & state
    'fresh', 'raw', 'cooked', 'frozen', 'dried', 'canned', 'organic', 'ripe',
    // Preparation methods
    'sliced', 'chopped', 'diced', 'minced', 'ground', 'cubed', 'shredded',
    'fillet', 'piece', 'chunk', 'strip', 'steak', 'chop', 'cutlet',
    // Cooking methods
    'boiled', 'fried', 'grilled', 'roasted', 'baked', 'steamed', 'sauteed',
    // Size/quantity
    'whole', 'half', 'quarter', 'large', 'small', 'medium', 'boneless',
    // Colors (often confuse detection)
    'red', 'white', 'yellow', 'green', 'brown', 'pink'
]);
// Compact HEADS set (proteins, fungi, common fruits/veg, staples)
const HEADS = new Set([
    // Proteins - Poultry
    'chicken', 'turkey', 'duck', 'egg',
    // Proteins - Red Meat
    'beef', 'mutton', 'lamb', 'pork', 'veal', 'goat',
    // Proteins - Seafood (Fish)
    'fish', 'salmon', 'tuna', 'cod', 'tilapia',
    // Proteins - Seafood (Shellfish & Others)
    'shrimp', 'prawn', 'lobster', 'crab', 'oyster', 'clam', 'mussel',
    'octopus', 'squid', 'cuttlefish',
    // Dairy
    'milk', 'yogurt', 'cheese', 'paneer', 'butter', 'ghee',
    // Fungi
    'mushroom',
    // Staples
    'rice', 'pasta', 'noodle', 'bread', 'flour', 'wheat', 'sugar', 'salt', 'oil',
    // Fruits
    'mango', 'banana', 'apple', 'orange', 'lemon', 'lime', 'grape',
    'pineapple', 'papaya', 'watermelon', 'strawberry', 'blueberry',
    // Vegetables
    'potato', 'onion', 'tomato', 'garlic', 'ginger', 'carrot', 'cabbage',
    'cauliflower', 'cucumber', 'pepper', 'chili', 'spinach', 'broccoli',
    'beans', 'pea', 'corn'
]);
// Thresholds - Core Detection
const AREA_DOMINANCE_THRESHOLD = 0.40; // 40% coverage for single-item
const AREA_MULTI_THRESHOLD = 0.25; // 25% for multi-item
const CONFIDENCE_MIN = 0.65; // Min confidence for area dominance (lowered from 0.70 for chopped meats)
const CONFIDENCE_TOLERANCE = 0.15; // Within 15% for multi-item
const SCORE_MIN = 0.52; // Min score to keep (lowered from 0.58 for better detection)
const SCORE_DOMINANCE = 0.82; // Score for single-item dominance
const SCORE_RATIO = 1.5; // Ratio for dominance filter
const MAX_RESULTS = 3;
// Thresholds - Enhancement Layer
const CORE_CONFIDENCE_THRESHOLD = 0.55; // If core result ≥ this, accept as-is (lowered from 0.6)
const ENHANCED_AREA_THRESHOLD = 0.30; // 30% for enhanced area dominance (lowered from 0.35)
const FALLBACK_CONFIDENCE = 0.85; // Last-resort threshold (lowered from 0.9 for better coverage)
const NON_VEG_DEFAULT_SCORE = 0.88;
// Tags that indicate the image is about food/produce.
const FOOD_CONTEXT_TAGS = new Set([
    'food',
    'fruit',
    'vegetable',
    'veggies',
    'produce',
    'meat',
    'seafood',
    'fish',
    'chicken',
    'poultry',
    'beef',
    'mutton',
    'pork',
    'dairy',
    'milk',
    'egg',
    'eggs',
    'cheese',
    'yogurt',
    'grain',
    'cereal',
    'bread',
    'pasta',
    'rice',
    'noodle',
    'noodles'
]);
// Tag names we never want to return directly as the ingredient.
const GENERIC_FOOD_TAGS = new Set([
    ...FOOD_CONTEXT_TAGS,
    'natural foods',
    'nutrition',
    'diet',
    'superfood',
    'local food',
    'whole food',
    'ingredient',
    'cuisine',
    'dish',
    'meal',
    'snack',
    'indoor',
    'outdoor',
    'red',
    'green',
    'yellow',
    'orange',
    'drupe'
]);
// Final labels that are too generic and should be specialized when possible.
const GENERIC_INGREDIENT_LABELS = new Set([
    'fruit',
    'vegetable',
    'veggies',
    'produce'
]);
// === VEG / FRUIT CANONICALIZATION ===
// 🚫 Labels that are too generic to be useful as a final ingredient
const GENERIC_VEG_LABELS = new Set([
    'fruit',
    'fruits',
    'vegetable',
    'vegetables',
    'produce',
    'food',
    'foods',
    'natural foods',
    'local food',
    'local foods',
    'diet food',
    'diet foods',
    'ingredient',
    'ingredients',
    'superfood',
    'vegan nutrition',
    'vegetarian food',
    'whole food',
    'root vegetable',
    'leaf vegetable',
    'accessory fruit',
    'frutti di bosco'
]);
function isGenericVegLabel(name) {
    if (!name)
        return false;
    const key = name.toLowerCase().trim();
    if (GENERIC_VEG_LABELS.has(key))
        return true;
    if (key.endsWith('s') && GENERIC_VEG_LABELS.has(key.slice(0, -1)))
        return true;
    return false;
}
// Labels we NEVER want as final ingredients (too generic or not food).
const GENERIC_VEGFRUIT_TAGS = new Set([
    'food',
    'foods',
    'fruit',
    'fruits',
    'vegetable',
    'vegetables',
    'natural foods',
    'produce',
    'citrus',
    'berry',
    'berries',
    'seedless fruit',
    'whole food',
    'whole foods',
    'diet food',
    'diet foods',
    'superfood',
    'superfoods',
    'superfruit',
    'superfruits',
    'local food',
    'local foods',
    'vegan nutrition',
    'accessory fruit',
    'staple food',
    'ingredient',
    // non-ingredient concepts that broke fallback (e.g. human photo case)
    'person',
    'human',
    'human face',
    'wall',
    'indoor',
    'man',
    'woman',
    'clothing',
    'laptop',
    'floor',
    'sitting',
    'animal',
    'invertebrate',
    'arthropod',
    'crustacean',
    'insect'
]);
// Synonyms / very specific labels → canonical ingredient name
const VEGFRUIT_CANONICAL_ALIASES = {
    // oranges / citrus
    'orange': 'orange',
    'oranges': 'orange',
    'mandarin orange': 'orange',
    'bitter orange': 'orange',
    'valencia orange': 'orange',
    'blood orange': 'orange',
    'clementine': 'orange',
    'tangerine': 'orange',
    'calamondin': 'orange',
    'rangpur': 'orange',
    'tangelo': 'orange',
    // strawberries
    'strawberry': 'strawberry',
    'strawberries': 'strawberry',
    'virginia strawberry': 'strawberry',
    'alpine strawberry': 'strawberry',
    // berries → blueberry family
    'blueberry': 'blueberry',
    'bilberry': 'blueberry',
    'huckleberry': 'blueberry',
    'zante currant': 'blueberry',
    // cherries
    'cherry': 'cherry',
    'cherries': 'cherry',
    // melon / watermelon
    'watermelon': 'watermelon',
    'melon': 'melon', // will be dropped if watermelon also exists
    // kiwi
    'kiwi': 'kiwi',
    'kiwi fruit': 'kiwi',
    // tomatoes
    'tomato': 'tomato',
    'tomatoes': 'tomato',
    'cherry tomatoes': 'tomato',
    'plum tomato': 'tomato',
    'bush tomato': 'tomato',
    // custard apple
    'custard apple': 'custard apple',
    // pomegranate
    'pomegranate': 'pomegranate',
    // pineapple
    'pineapple': 'pineapple',
    'ananas': 'pineapple',
    // mango
    'mango': 'mango',
    // stone fruits
    'peach': 'peach',
    'nectarine': 'peach',
    'apricot': 'apricot',
    // cabbage
    'cabbage': 'cabbage',
    'wild cabbage': 'cabbage',
    // potato family
    'potato': 'potato',
    'russet burbank potato': 'potato',
    'yukon gold potato': 'potato',
    // garlic / onion family
    'garlic': 'garlic',
    'elephant garlic': 'garlic',
    'onion': 'onion',
    'red onion': 'onion',
    'yellow onion': 'onion',
    'shallot': 'onion',
    'pearl onion': 'onion',
    // mushrooms
    'mushroom': 'mushroom',
    'edible mushroom': 'mushroom',
    // milk / dairy
    'milk': 'milk',
    'dairy': 'milk',
    'plant milk': 'milk',
    'almond milk': 'milk',
    'grain milk': 'milk',
    // pasta (keep as is)
    'pasta': 'pasta'
};
// Canonical ingredient names we actually allow as veg/veg-side outputs
const BASE_INGREDIENT_KEYS = new Set([
    // fruits
    'apple',
    'custard apple',
    'orange',
    'mango',
    'banana',
    'pomegranate',
    'watermelon',
    'melon',
    'kiwi',
    'cherry',
    'strawberry',
    'blueberry',
    'pineapple',
    'grape',
    'papaya',
    'lemon',
    'lime',
    'peach',
    'apricot',
    // vegetables / plant ingredients
    'tomato',
    'cabbage',
    'potato',
    'garlic',
    'onion',
    'mushroom',
    'carrot',
    'broccoli',
    'spinach',
    'peas',
    'corn',
    // other veg-side ingredients
    'milk',
    'pasta'
]);
function normalizeVegFruitTagRaw(name) {
    return (name || '').trim().toLowerCase();
}
function chooseCanonicalVegFruitFromTags(azureTags) {
    if (!azureTags || azureTags.length === 0)
        return null;
    const allTags = azureTags.map((t) => {
        const rawName = t.name ?? t.tagName ?? '';
        const norm = normalizeVegFruitTagRaw(rawName);
        const conf = t.confidence ?? t.confidenceScore ?? 0;
        const canon = VEGFRUIT_CANONICAL_ALIASES[norm] ?? norm;
        return {
            raw: rawName,
            norm,
            canon,
            confidence: Math.max(0, Math.min(conf, 1))
        };
    });
    // Drop generic / non-food / non-ingredient labels
    const filtered = allTags.filter((c) => {
        if (!c.canon)
            return false;
        // Block generic and clearly-non-ingredient tags
        if (GENERIC_VEGFRUIT_TAGS.has(c.norm))
            return false;
        if (GENERIC_VEGFRUIT_TAGS.has(c.canon))
            return false;
        // Only allow canonical names that are real ingredients
        if (BASE_INGREDIENT_KEYS.has(c.canon))
            return true;
        return false;
    });
    if (filtered.length === 0) {
        return null;
    }
    // Special case: if we have watermelon, drop plain "melon"
    const hasWatermelon = filtered.some((c) => c.canon === 'watermelon');
    const finalCandidates = hasWatermelon
        ? filtered.filter((c) => c.canon !== 'melon')
        : filtered;
    if (finalCandidates.length === 0)
        return null;
    // Choose best candidate using confidence + specificity
    let best = finalCandidates[0];
    const score = (c) => {
        const wordCount = c.canon.split(/\s+/).filter(Boolean).length;
        const charCount = c.canon.length;
        return {
            confidence: c.confidence,
            wordCount,
            charCount
        };
    };
    for (const c of finalCandidates.slice(1)) {
        const sb = score(best);
        const sc = score(c);
        // Prefer higher confidence (with a small margin)
        if (sc.confidence > sb.confidence + 0.03) {
            best = c;
            continue;
        }
        if (sb.confidence > sc.confidence + 0.03) {
            continue;
        }
        // Same-ish confidence: prefer more specific (more words)
        if (sc.wordCount > sb.wordCount) {
            best = c;
            continue;
        }
        if (sb.wordCount > sc.wordCount) {
            continue;
        }
        // Still tied: prefer longer canonical name (more characters)
        if (sc.charCount > sb.charCount) {
            best = c;
            continue;
        }
        if (sb.charCount > sc.charCount) {
            continue;
        }
        // Final tiny nudge: slightly higher confidence
        if (sc.confidence > sb.confidence) {
            best = c;
        }
    }
    // --- Stone-fruit vs apple disambiguation ---
    const stoneFruitNames = new Set(['peach', 'apricot']);
    const stoneCandidates = finalCandidates.filter(c => stoneFruitNames.has(c.canon));
    const appleCandidates = finalCandidates.filter(c => c.canon === 'apple');
    if (stoneCandidates.length && appleCandidates.length) {
        const bestStone = stoneCandidates.reduce((a, b) => (a.confidence >= b.confidence ? a : b));
        const bestApple = appleCandidates.reduce((a, b) => (a.confidence >= b.confidence ? a : b));
        if (bestStone.confidence >= 0.8 &&
            bestApple.confidence <= bestStone.confidence + 0.04) {
            return bestStone;
        }
    }
    return best;
}
function pickSpecificVegTagFromAzureTags(tags) {
    if (!tags || tags.length === 0)
        return null;
    const specific = tags.filter(tag => !isGenericVegLabel(tag.name));
    if (specific.length === 0)
        return null;
    const sorted = [...specific].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    const best = sorted[0];
    if ((best.confidence ?? 0) < 0.6)
        return null;
    return best;
}
function finalizeVegOutput(normalized, tags, stageLabel) {
    if (!normalized || normalized.length === 0)
        return null;
    let finalLabel = normalized[0].name;
    let finalScore = normalized[0].score;
    if (isGenericVegLabel(finalLabel)) {
        if (tags && tags.length > 0) {
            const salvage = pickSpecificVegTagFromAzureTags(tags);
            if (salvage) {
                const canonicalFromTag = VEGFRUIT_CANONICAL_ALIASES[salvage.name.toLowerCase()] ??
                    salvage.name.toLowerCase();
                console.log(`🍃 Generic veg label "${finalLabel}" salvaged via tags → "${canonicalFromTag}" (${((salvage.confidence ?? 0) * 100).toFixed(1)}%)`);
                finalLabel = canonicalFromTag;
                finalScore = salvage.confidence ?? finalScore;
            }
            else {
                console.log(`🍃 Generic veg label "${finalLabel}" with no specific alternative – dropping ingredient`);
                return null;
            }
        }
        else {
            console.log(`🍃 Generic veg label "${finalLabel}" with no tags available – dropping ingredient`);
            return null;
        }
    }
    if (isGenericVegLabel(finalLabel)) {
        console.log(`🍃 Still generic veg label "${finalLabel}" after salvage – treating as no ingredient`);
        return null;
    }
    const canonicalVeg = VEGFRUIT_CANONICAL_ALIASES[finalLabel.toLowerCase()] ??
        finalLabel.toLowerCase();
    const result = [{
            name: canonicalVeg,
            score: finalScore
        }];
    console.log(`🎉 FINAL RESULT (Veg canonical - ${stageLabel}):`);
    result.forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.name}: ${(item.score * 100).toFixed(1)}%`);
    });
    console.log('╚═══════════════════════════════════════════╝\n');
    return result;
}
// Take existing detection (core/enhanced) and "snap" it to a canonical veg name from tags.
function finalizeVegFruitFromTags(azureTags, existing) {
    const best = chooseCanonicalVegFruitFromTags(azureTags);
    if (!best) {
        return existing;
    }
    const base = (existing && existing[0]) || {};
    return [
        {
            ...base,
            name: best.canon,
            score: Math.max(base.score ?? 0, best.confidence)
        }
    ];
}
function createDetectionMeta() {
    return {
        tags: [],
        captions: []
    };
}
function applyNonVegResolution(stageLabel, results, meta) {
    const candidateNames = results.map(r => r.name);
    const override = resolveNonVeg(candidateNames, meta.tags || [], meta.captions || []);
    if (!override) {
        return results;
    }
    console.log(`🥩 Non-veg resolver override (${stageLabel}): ${override}`);
    const existing = results.find(r => r.name === override);
    if (existing) {
        return [existing];
    }
    return [{
            name: override,
            score: NON_VEG_DEFAULT_SCORE
        }];
}
function normalizeNonVegRaw(name) {
    return (name || '').trim().toLowerCase();
}
function resolveCephalopodFromVision(tags, captions) {
    const allTags = tags ?? [];
    const allCaps = captions ?? [];
    let bestOctopusScore = 0;
    let bestSquidScore = 0;
    for (const t of allTags) {
        const raw = t.name ?? t.tagName ?? '';
        const norm = normalizeNonVegRaw(raw);
        const conf = t.confidence ?? t.confidenceScore ?? t.confidence ?? 0;
        if (!norm)
            continue;
        if (norm.includes('octopus')) {
            bestOctopusScore = Math.max(bestOctopusScore, conf);
        }
        else if (norm.includes('squid')) {
            bestSquidScore = Math.max(bestSquidScore, conf);
        }
    }
    for (const c of allCaps) {
        const text = normalizeNonVegRaw(c?.text ?? c?.content ?? '');
        if (!text)
            continue;
        const conf = c?.confidence ?? c?.confidenceScore ?? 0.7;
        if (text.includes('octopus')) {
            bestOctopusScore = Math.max(bestOctopusScore, conf);
        }
        if (text.includes('squid')) {
            bestSquidScore = Math.max(bestSquidScore, conf);
        }
    }
    const MIN_CEPHALOPOD_CONF = 0.6;
    const finalScore = Math.max(bestOctopusScore, bestSquidScore);
    if (finalScore >= MIN_CEPHALOPOD_CONF) {
        return {
            name: 'octopus',
            score: finalScore
        };
    }
    return null;
}
function logFinalResult(stageLabel, results) {
    if (results.length > 0) {
        console.log(`\n🎉 FINAL RESULT (${stageLabel}):`);
        results.forEach((item, idx) => {
            console.log(`  ${idx + 1}. ${item.name}: ${(item.score * 100).toFixed(1)}%`);
        });
    }
    else {
        console.log('\n❌ NO INGREDIENTS DETECTED');
    }
    console.log('╚═══════════════════════════════════════════╝\n');
}
// ==================== NORMALIZATION ====================
/**
 * Convert to singular form
 */
function toSingular(w) {
    if (w === 'tomatoes')
        return 'tomato';
    if (w === 'potatoes')
        return 'potato';
    if (w === 'fungi')
        return 'fungus';
    if (w === 'leaves')
        return 'leaf';
    if (/^(?:.*?)(ses|xes|zes|ches|shes)$/.test(w))
        return w.replace(/es$/, '');
    if (/^(?:.*[^s])s$/.test(w))
        return w.replace(/s$/, '');
    return w;
}
/**
 * Clean and normalize string
 */
function clean(s) {
    return s.toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
/**
 * Strip descriptors from phrase
 */
function stripDescriptors(phrase) {
    return phrase.split(' ')
        .filter(t => !DESCRIPTORS.has(t))
        .join(' ')
        .trim();
}
/**
 * Resolve phrase to right-most known headword
 * e.g., "king oyster mushroom" → "mushroom", "anchovy fish" → "fish"
 */
function headword(phrase) {
    const tokens = phrase.split(' ').map(toSingular);
    // Check from right to left
    for (let i = tokens.length - 1; i >= 0; i--) {
        if (HEADS.has(tokens[i]))
            return tokens[i];
    }
    // Fall back: single token if it's a head
    return HEADS.has(tokens[0]) && tokens.length === 1 ? tokens[0] : null;
}
/**
 * Normalize a candidate name
 */
function normalize(name) {
    const cleaned = clean(stripDescriptors(name));
    const singular = toSingular(cleaned);
    // Drop generics
    if (GENERIC.has(singular))
        return null;
    // Resolve to headword
    return headword(singular);
}
// ==================== AZURE VISION ====================
/**
 * Call Azure Vision API
 */
async function callAzureVision(imageBytes, features, endpoint, apiKey) {
    const url = `${endpoint}/computervision/imageanalysis:analyze?api-version=2023-10-01&features=${features.join('%2C')}&model-version=latest`;
    // Convert base64 to binary
    const binaryString = atob(imageBytes);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/octet-stream',
            'Ocp-Apim-Subscription-Key': apiKey
        },
        body: bytes
    });
    if (!response.ok) {
        const errorText = await response.text();
        console.error('Azure Vision API error:', errorText);
        throw new Error(`Azure Vision API error: ${response.status}`);
    }
    const result = await response.json();
    // Log raw Azure results
    console.log('\n📊 Azure Vision Raw Results:');
    const tags = result.tagsResult?.values || [];
    if (tags.length > 0) {
        console.log(`\n🏷️  Tags (${tags.length}):`);
        tags.slice(0, 15).forEach((tag, i) => {
            console.log(`  ${i + 1}. ${tag.name}: ${(tag.confidence * 100).toFixed(1)}%`);
        });
        if (tags.length > 15) {
            console.log(`  ... and ${tags.length - 15} more`);
        }
    }
    const captions = result.denseCaptionsResult?.values || [];
    if (captions.length > 0) {
        console.log(`\n💬 Captions (${captions.length}):`);
        captions.slice(0, 5).forEach((caption, i) => {
            console.log(`  ${i + 1}. "${caption.text}" (${(caption.confidence * 100).toFixed(1)}%)`);
        });
        if (captions.length > 5) {
            console.log(`  ... and ${captions.length - 5} more`);
        }
    }
    const objects = result.objectsResult?.values || [];
    if (objects.length > 0) {
        console.log(`\n📦 Objects (${objects.length}):`);
        objects.slice(0, 5).forEach((obj, i) => {
            const objTags = obj.tags || [];
            if (objTags.length > 0) {
                console.log(`  ${i + 1}. ${objTags[0].name}: ${(objTags[0].confidence * 100).toFixed(1)}%`);
            }
        });
        if (objects.length > 5) {
            console.log(`  ... and ${objects.length - 5} more`);
        }
    }
    console.log('');
    return result;
}
/**
 * Convert image URI to base64
 */
async function imageToBase64(uri) {
    const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64
    });
    return base64;
}
// ==================== PREPROCESSING ====================
/**
 * Preprocess image for fallback
 */
async function preprocessImage(uri) {
    try {
        const actions = [];
        // Get image info
        const info = await ImageManipulator.manipulateAsync(uri, [], {
            compress: 1,
            format: ImageManipulator.SaveFormat.JPEG
        });
        const { width, height } = info;
        const aspectRatio = width / height;
        // Center-crop to square if aspect ratio > 1.6
        if (aspectRatio > 1.6 || aspectRatio < 0.625) {
            const size = Math.min(width, height);
            const x = (width - size) / 2;
            const y = (height - size) / 2;
            actions.push({
                crop: {
                    originX: x,
                    originY: y,
                    width: size,
                    height: size
                }
            });
        }
        // Downscale to 1024px max
        const maxDim = Math.max(width, height);
        if (maxDim > 1024) {
            actions.push({
                resize: {
                    width: width > height ? 1024 : undefined,
                    height: height > width ? 1024 : undefined
                }
            });
        }
        const result = await ImageManipulator.manipulateAsync(uri, actions, {
            compress: 0.8,
            format: ImageManipulator.SaveFormat.JPEG
        });
        return result.uri;
    }
    catch (error) {
        console.warn('⚠️  Preprocessing failed, using original:', error);
        return uri;
    }
}
// ==================== STAGE 1: CORE DETECTION (UNCHANGED BASELINE) ====================
/**
 * Extract candidates from Azure response
 */
function extractCandidates(response) {
    const candidates = [];
    // Objects with area
    if (response.objectsResult?.values) {
        for (const obj of response.objectsResult.values) {
            if (obj.tags && obj.tags.length > 0) {
                const tag = obj.tags[0];
                const box = obj.boundingBox || { x: 0, y: 0, w: 100, h: 100 };
                const area = box.w * box.h;
                candidates.push({
                    name: tag.name,
                    confidence: tag.confidence,
                    source: 'object',
                    area
                });
            }
        }
    }
    // Tags
    if (response.tagsResult?.values) {
        for (const tag of response.tagsResult.values) {
            candidates.push({
                name: tag.name,
                confidence: tag.confidence,
                source: 'tag'
            });
        }
    }
    return candidates;
}
/**
 * Apply object-area dominance rule
 */
function applyAreaDominance(candidates) {
    const objects = candidates.filter(c => c.source === 'object' && c.area !== undefined);
    if (objects.length === 0)
        return null;
    // Sort by area descending
    objects.sort((a, b) => (b.area || 0) - (a.area || 0));
    const topObject = objects[0];
    const topArea = topObject.area || 0;
    // Single-item dominance: ≥40% coverage and ≥0.70 confidence
    if (topArea >= AREA_DOMINANCE_THRESHOLD * 10000 && topObject.confidence >= CONFIDENCE_MIN) {
        console.log(`🎯 Area dominance: "${topObject.name}" covers ${(topArea / 100).toFixed(1)}% (conf: ${topObject.confidence.toFixed(2)})`);
        return [topObject];
    }
    // Multi-item: keep objects with ≥25% area and within 15% confidence
    const significant = objects.filter(obj => {
        const area = obj.area || 0;
        const confDiff = Math.abs(obj.confidence - topObject.confidence);
        return area >= AREA_MULTI_THRESHOLD * 10000 && confDiff <= CONFIDENCE_TOLERANCE;
    });
    if (significant.length > 1) {
        console.log(`🎯 Multi-object: ${significant.length} significant objects`);
        return significant;
    }
    return null;
}
/**
 * Score and filter candidates
 */
function scoreCandidates(candidates, useDenseCaptions = false, response) {
    const nameMap = new Map();
    // Normalize and collect
    for (const candidate of candidates) {
        const normalized = normalize(candidate.name);
        if (!normalized)
            continue;
        if (!nameMap.has(normalized)) {
            nameMap.set(normalized, { score: 0, sources: new Set() });
        }
        const entry = nameMap.get(normalized);
        entry.sources.add(candidate.source);
        // Base score from confidence
        let score = candidate.confidence;
        // Bonus if in both objects and tags
        if (entry.sources.has('object') && entry.sources.has('tag')) {
            score += 0.15;
        }
        // Update if higher
        if (score > entry.score) {
            entry.score = score;
        }
    }
    // Add dense captions contribution if enabled
    if (useDenseCaptions && response?.denseCaptionsResult?.values) {
        for (const caption of response.denseCaptionsResult.values) {
            const words = clean(caption.text).split(/\s+/);
            for (const word of words) {
                const singular = toSingular(word);
                if (HEADS.has(singular)) {
                    if (!nameMap.has(singular)) {
                        nameMap.set(singular, { score: caption.confidence * 0.6, sources: new Set(['caption']) });
                    }
                    else {
                        const entry = nameMap.get(singular);
                        entry.score += 0.10;
                        entry.sources.add('caption');
                    }
                }
            }
        }
    }
    // Convert to array and filter
    const allScored = Array.from(nameMap.entries())
        .map(([name, { score }]) => ({ name, score }))
        .sort((a, b) => b.score - a.score);
    // Log all candidates before filtering
    if (allScored.length > 0) {
        console.log(`\n🎯 Candidates after normalization (${allScored.length}):`);
        allScored.slice(0, 10).forEach((item, i) => {
            console.log(`  ${i + 1}. ${item.name}: ${item.score.toFixed(3)}`);
        });
        if (allScored.length > 10) {
            console.log(`  ... and ${allScored.length - 10} more`);
        }
    }
    const scored = allScored.filter(item => item.score >= SCORE_MIN);
    if (scored.length < allScored.length) {
        console.log(`🗑️  Filtered out ${allScored.length - scored.length} low-confidence items (< ${SCORE_MIN})`);
    }
    // Sibling disambiguation (specificity filter)
    const parentCategories = new Set(['meat', 'seafood', 'animal', 'crustacean', 'invertebrate', 'mollusk', 'shellfish']);
    // Define protein categories with hierarchy
    const redMeat = new Set(['beef', 'mutton', 'lamb', 'pork', 'veal', 'goat']);
    const poultry = new Set(['chicken', 'turkey', 'duck']);
    const fishTypes = new Set(['fish', 'salmon', 'tuna', 'cod', 'tilapia']);
    const shellfish = new Set(['shrimp', 'prawn', 'lobster', 'crab', 'oyster', 'clam', 'mussel']);
    const cephalopods = new Set(['octopus', 'squid', 'cuttlefish']);
    const allProteins = new Set([
        ...redMeat, ...poultry, ...fishTypes, ...shellfish, ...cephalopods
    ]);
    // Remove parent categories if any specific protein exists
    if (scored.some(s => allProteins.has(s.name))) {
        const filtered = scored.filter(s => !parentCategories.has(s.name));
        if (filtered.length !== scored.length) {
            console.log(`🗑️  Removed parent categories: ${scored.length - filtered.length}`);
        }
        // Apply seafood hierarchy: if octopus/squid exists, remove generic "fish"
        const hasCephalopod = filtered.some(s => cephalopods.has(s.name));
        const hasShellfish = filtered.some(s => shellfish.has(s.name));
        let hierarchyFiltered = filtered;
        if (hasCephalopod || hasShellfish) {
            // Remove generic "fish" if we have specific seafood
            hierarchyFiltered = filtered.filter(s => s.name !== 'fish');
            if (hierarchyFiltered.length !== filtered.length) {
                console.log(`🗑️  Removed generic "fish" (specific seafood detected)`);
            }
        }
        // If multiple proteins detected (siblings in same category), apply strict dominance
        const proteins = hierarchyFiltered.filter(s => allProteins.has(s.name));
        if (proteins.length > 1) {
            // Check if they're in the same category (siblings)
            const categories = [
                { name: 'red meat', set: redMeat },
                { name: 'poultry', set: poultry },
                { name: 'fish', set: fishTypes },
                { name: 'shellfish', set: shellfish },
                { name: 'cephalopods', set: cephalopods }
            ];
            for (const category of categories) {
                const inCategory = proteins.filter(p => category.set.has(p.name));
                if (inCategory.length > 1) {
                    console.log(`⚠️  Multiple ${category.name} detected: ${inCategory.map(p => p.name).join(', ')}`);
                    // Return only the highest-scoring protein in this category
                    return [inCategory[0]];
                }
            }
        }
        return applyDominanceFilter(hierarchyFiltered);
    }
    return applyDominanceFilter(scored);
}
/**
 * Apply dominance filter
 */
function applyDominanceFilter(scored) {
    if (scored.length === 0)
        return [];
    // Dominance filter: if top ≥0.82 and ≥1.5× next, return top only
    if (scored[0].score >= SCORE_DOMINANCE &&
        scored[0].score >= (scored[1]?.score ?? 0) * SCORE_RATIO) {
        console.log(`🎯 Dominance: "${scored[0].name}" (${scored[0].score.toFixed(2)}) >> others`);
        return [scored[0]];
    }
    // Return top MAX_RESULTS
    return scored.slice(0, MAX_RESULTS);
}
/**
 * Core detection (unchanged baseline)
 * This is the working logic - DO NOT MODIFY
 */
async function detectCore(imageBytes, endpoint, apiKey, meta) {
    console.log('🔵 Core detection (baseline)');
    // Call Azure Vision (objects, tags, read only - no dense captions)
    const response = await callAzureVision(imageBytes, ['objects', 'tags', 'read'], endpoint, apiKey);
    if (meta) {
        meta.tags = response.tagsResult?.values ? [...response.tagsResult.values] : [];
        meta.captions = [];
    }
    // Extract candidates
    const candidates = extractCandidates(response);
    console.log(`📋 Core: ${candidates.length} candidates`);
    // Apply area dominance
    const dominantCandidates = applyAreaDominance(candidates);
    if (dominantCandidates) {
        // Area dominance applied, score these only
        const result = scoreCandidates(dominantCandidates);
        if (result.length > 0) {
            console.log(`✅ Core result (area-dominant): ${result.map(r => r.name).join(', ')}`);
            return result;
        }
    }
    // No area dominance, score all candidates
    const result = scoreCandidates(candidates);
    if (result.length > 0) {
        console.log(`✅ Core result: ${result.map(r => r.name).join(', ')}`);
        return result;
    }
    console.log('⚠️  Core returned empty');
    return [];
}
// ==================== STAGE 2: ENHANCEMENT LAYER ====================
/**
 * Enhanced area dominance (35% threshold)
 */
function applyEnhancedAreaDominance(candidates) {
    const objects = candidates.filter(c => c.source === 'object' && c.area !== undefined);
    if (objects.length === 0)
        return null;
    // Sort by area descending
    objects.sort((a, b) => (b.area || 0) - (a.area || 0));
    const topObject = objects[0];
    const topArea = topObject.area || 0;
    // Enhanced dominance: ≥35% coverage
    if (topArea >= ENHANCED_AREA_THRESHOLD * 10000) {
        const normalized = normalize(topObject.name);
        if (normalized) {
            console.log(`🎯 Enhanced area dominance: "${normalized}" covers ${(topArea / 100).toFixed(1)}%`);
            return normalized;
        }
    }
    return null;
}
/**
 * Enhanced scoring with confidence balancing
 */
function scoreEnhanced(candidates, response) {
    const nameMap = new Map();
    // Normalize and collect
    for (const candidate of candidates) {
        const cleaned = clean(stripDescriptors(candidate.name));
        const singular = toSingular(cleaned);
        const isGeneric = GENERIC.has(singular);
        // Resolve to headword
        const normalized = headword(singular);
        if (!normalized && !isGeneric)
            continue; // Skip if not a headword and not generic
        const key = normalized || singular;
        if (!nameMap.has(key)) {
            nameMap.set(key, { score: 0, sources: new Set(), isGeneric });
        }
        const entry = nameMap.get(key);
        entry.sources.add(candidate.source);
        // Base score from confidence
        let score = candidate.confidence;
        // Confidence balancing: prefer objects > tags > captions
        if (candidate.source === 'object') {
            score += 0.05;
        }
        // Bonus if object & tag match
        if (entry.sources.has('object') && entry.sources.has('tag')) {
            score += 0.1;
        }
        // Penalty if generic
        if (isGeneric) {
            score -= 0.2;
        }
        // Update if higher
        if (score > entry.score) {
            entry.score = score;
        }
    }
    // Add dense captions contribution
    if (response.denseCaptionsResult?.values) {
        for (const caption of response.denseCaptionsResult.values) {
            const words = clean(caption.text).split(/\s+/);
            for (const word of words) {
                const singular = toSingular(word);
                if (HEADS.has(singular)) {
                    if (nameMap.has(singular)) {
                        const entry = nameMap.get(singular);
                        entry.score += 0.15; // Caption confirms headword
                        entry.sources.add('caption');
                    }
                }
            }
        }
    }
    // Convert to array and filter
    const scored = Array.from(nameMap.entries())
        .map(([name, { score, isGeneric }]) => ({ name, score, isGeneric }))
        .filter(item => !item.isGeneric || nameMap.size === 1) // Drop generics unless only option
        .filter(item => item.score >= 0.5)
        .sort((a, b) => b.score - a.score);
    // Semantic correction: if specific protein exists, drop parents
    const parentCategories = new Set(['meat', 'seafood', 'animal', 'crustacean', 'invertebrate', 'mollusk', 'shellfish']);
    // Define protein categories with hierarchy
    const redMeat = new Set(['beef', 'mutton', 'lamb', 'pork', 'veal', 'goat']);
    const poultry = new Set(['chicken', 'turkey', 'duck']);
    const fishTypes = new Set(['fish', 'salmon', 'tuna', 'cod', 'tilapia']);
    const shellfish = new Set(['shrimp', 'prawn', 'lobster', 'crab', 'oyster', 'clam', 'mussel']);
    const cephalopods = new Set(['octopus', 'squid', 'cuttlefish']);
    const allProteins = new Set([
        ...redMeat, ...poultry, ...fishTypes, ...shellfish, ...cephalopods
    ]);
    if (scored.some(s => allProteins.has(s.name))) {
        const filtered = scored.filter(s => !parentCategories.has(s.name));
        if (filtered.length !== scored.length) {
            console.log(`🗑️  Enhanced: Removed parent categories`);
        }
        // Apply seafood hierarchy: if octopus/squid exists, remove generic "fish"
        const hasCephalopod = filtered.some(s => cephalopods.has(s.name));
        const hasShellfish = filtered.some(s => shellfish.has(s.name));
        let hierarchyFiltered = filtered;
        if (hasCephalopod || hasShellfish) {
            // Remove generic "fish" if we have specific seafood
            hierarchyFiltered = filtered.filter(s => s.name !== 'fish');
            if (hierarchyFiltered.length !== filtered.length) {
                console.log(`🗑️  Enhanced: Removed generic "fish" (specific seafood detected)`);
            }
        }
        // If multiple proteins detected (siblings in same category), apply strict dominance
        const proteins = hierarchyFiltered.filter(s => allProteins.has(s.name));
        if (proteins.length > 1) {
            // Check if they're in the same category (siblings)
            const categories = [
                { name: 'red meat', set: redMeat },
                { name: 'poultry', set: poultry },
                { name: 'fish', set: fishTypes },
                { name: 'shellfish', set: shellfish },
                { name: 'cephalopods', set: cephalopods }
            ];
            for (const category of categories) {
                const inCategory = proteins.filter(p => category.set.has(p.name));
                if (inCategory.length > 1) {
                    console.log(`⚠️  Enhanced: Multiple ${category.name} detected: ${inCategory.map(p => p.name).join(', ')}`);
                    // Return only the highest-scoring protein in this category
                    return [{ name: inCategory[0].name, score: inCategory[0].score }];
                }
            }
        }
        return hierarchyFiltered.slice(0, MAX_RESULTS).map(({ name, score }) => ({ name, score }));
    }
    // Return top 1-3 unique heads
    return scored.slice(0, MAX_RESULTS).map(({ name, score }) => ({ name, score }));
}
/**
 * Enhancement layer (validation + correction wrapper)
 */
async function detectIngredientsEnhanced(imageBytes, endpoint, apiKey, meta) {
    console.log('🟢 Enhancement layer (refinement)');
    // Secondary Azure call with dense captions
    const response = await callAzureVision(imageBytes, ['objects', 'tags', 'denseCaptions'], endpoint, apiKey);
    if (meta) {
        meta.tags = response.tagsResult?.values ? [...response.tagsResult.values] : [];
        meta.captions = response.denseCaptionsResult?.values ? [...response.denseCaptionsResult.values] : [];
    }
    // Extract candidates from this call
    const candidates = extractCandidates(response);
    // Add dense captions as candidates
    if (response.denseCaptionsResult?.values) {
        for (const caption of response.denseCaptionsResult.values) {
            const words = clean(caption.text).split(/\s+/);
            for (const word of words) {
                candidates.push({
                    name: word,
                    confidence: caption.confidence * 0.7,
                    source: 'caption'
                });
            }
        }
    }
    console.log(`📋 Enhanced: ${candidates.length} candidates (with captions)`);
    // Check for enhanced area dominance (35% threshold)
    const dominant = applyEnhancedAreaDominance(candidates);
    if (dominant) {
        return [{ name: dominant, score: 0.9 }];
    }
    // Apply enhanced scoring
    const result = scoreEnhanced(candidates, response);
    if (result.length > 0) {
        console.log(`✅ Enhanced result: ${result.map(r => r.name).join(', ')}`);
        return result;
    }
    console.log('⚠️  Enhanced layer returned empty');
    return [];
}
// ==================== STAGE 3: FALLBACK GUARD ====================
/**
 * Last-resort fallback guard
 */
async function fallbackGuard(imageBytes, endpoint, apiKey, meta) {
    console.log('🆘 Fallback guard (last resort)');
    // Call Azure Vision one more time (if not already called)
    const response = await callAzureVision(imageBytes, ['tags'], endpoint, apiKey);
    if (meta) {
        meta.tags = response.tagsResult?.values ? [...response.tagsResult.values] : [];
        meta.captions = [];
    }
    // Find highest-confidence non-generic tag ≥0.9
    if (response.tagsResult?.values) {
        const highConfTag = response.tagsResult.values
            .filter(tag => tag.confidence >= FALLBACK_CONFIDENCE)
            .sort((a, b) => b.confidence - a.confidence)[0];
        if (highConfTag) {
            const normalized = normalize(highConfTag.name);
            if (normalized) {
                console.log(`🆘 Fallback: "${normalized}" (conf: ${highConfTag.confidence.toFixed(2)})`);
                return [{ name: normalized, score: highConfTag.confidence }];
            }
        }
    }
    console.log('❌ Fallback guard also returned empty');
    return [];
}
// ==================== MAIN API ====================
/**
 * Detect ingredients from image
 * Hybrid pipeline: Core → Enhancement → Fallback
 *
 * @param uriOrBytes - Image URI or base64 bytes
 * @returns Array of detected ingredients (1-3 items)
 */
export async function detectIngredients(uriOrBytes) {
    try {
        console.log('\n╔═══════════════════════════════════════════╗');
        console.log('║  🎯 HYBRID DETECTION PIPELINE START      ║');
        console.log('╚═══════════════════════════════════════════╝');
        // Get Azure config
        const endpoint = Constants.expoConfig?.extra?.azureVisionEndpoint;
        const apiKey = Constants.expoConfig?.extra?.azureVisionKey;
        if (!endpoint || !apiKey) {
            throw new Error('Azure Vision credentials not configured');
        }
        // Convert to URI if needed
        const uri = typeof uriOrBytes === 'string' ? uriOrBytes : uriOrBytes.toString();
        const imageBytes = await imageToBase64(uri);
        // ==================== STAGE 1: CORE DETECTION ====================
        const coreMeta = createDetectionMeta();
        const coreResult = await detectCore(imageBytes, endpoint, apiKey, coreMeta);
        // Check if core result is good enough (confidence ≥ 0.6)
        if (coreResult.length > 0 && coreResult[0].score >= CORE_CONFIDENCE_THRESHOLD) {
            console.log(`✅ Core result accepted (confidence: ${coreResult[0].score.toFixed(2)} ≥ ${CORE_CONFIDENCE_THRESHOLD})`);
            // Apply non-veg resolution first (meat/fish/chicken etc.)
            let resolvedCore = applyNonVegResolution('Core', coreResult, coreMeta);
            // Check if this is a non-veg result
            const isNonVeg = resolvedCore.some(r => {
                const name = r.name.toLowerCase();
                return ['meat', 'fish', 'seafood', 'chicken', 'mutton', 'lamb', 'beef', 'pork',
                    'goat', 'turkey', 'duck', 'shrimp', 'prawn', 'lobster', 'crab',
                    'octopus', 'squid'].includes(name);
            });
            // For veg/fruit, apply canonical name resolution from tags
            if (!isNonVeg) {
                const normalized = finalizeVegFruitFromTags(coreMeta.tags || [], resolvedCore);
                const vegFinal = finalizeVegOutput(normalized, coreMeta.tags, 'Core');
                if (vegFinal && vegFinal.length > 0) {
                    return vegFinal;
                }
            }
            else {
                const cephalopod = resolveCephalopodFromVision(coreMeta.tags, coreMeta.captions);
                if (cephalopod) {
                    console.log('🥩 Non-veg cephalopod canonical (Core):', cephalopod.name);
                    resolvedCore = [{
                            name: cephalopod.name,
                            score: Math.max(cephalopod.score, resolvedCore[0]?.score ?? cephalopod.score)
                        }];
                }
            }
            logFinalResult('Core', resolvedCore);
            return resolvedCore;
        }
        // ==================== STAGE 2: ENHANCEMENT LAYER ====================
        // Core result empty or low confidence → trigger enhancement
        console.log(`⚠️  Core result insufficient (${coreResult.length === 0 ? 'empty' : `confidence: ${coreResult[0].score.toFixed(2)} < ${CORE_CONFIDENCE_THRESHOLD}`})`);
        const enhancedMeta = createDetectionMeta();
        const enhancedResult = await detectIngredientsEnhanced(imageBytes, endpoint, apiKey, enhancedMeta);
        if (enhancedResult.length > 0) {
            // Apply non-veg resolution first
            let resolvedEnhanced = applyNonVegResolution('Enhanced', enhancedResult, enhancedMeta);
            // Check if this is a non-veg result
            const isNonVeg = resolvedEnhanced.some(r => {
                const name = r.name.toLowerCase();
                return ['meat', 'fish', 'seafood', 'chicken', 'mutton', 'lamb', 'beef', 'pork',
                    'goat', 'turkey', 'duck', 'shrimp', 'prawn', 'lobster', 'crab',
                    'octopus', 'squid'].includes(name);
            });
            // For veg/fruit, apply canonical name resolution from tags
            if (!isNonVeg) {
                const normalized = finalizeVegFruitFromTags(enhancedMeta.tags || [], resolvedEnhanced);
                const vegFinal = finalizeVegOutput(normalized, enhancedMeta.tags, 'Enhanced');
                if (vegFinal && vegFinal.length > 0) {
                    return vegFinal;
                }
            }
            else {
                const cephalopod = resolveCephalopodFromVision(enhancedMeta.tags, enhancedMeta.captions);
                if (cephalopod) {
                    console.log('🥩 Non-veg cephalopod canonical (Enhanced):', cephalopod.name);
                    resolvedEnhanced = [{
                            name: cephalopod.name,
                            score: Math.max(cephalopod.score, resolvedEnhanced[0]?.score ?? cephalopod.score)
                        }];
                }
            }
            logFinalResult('Enhanced', resolvedEnhanced);
            return resolvedEnhanced;
        }
        // ==================== STAGE 3: FALLBACK GUARD ====================
        // Both core and enhancement failed → last resort
        console.log('⚠️  Enhancement also insufficient');
        const fallbackMeta = createDetectionMeta();
        const fallbackResult = await fallbackGuard(imageBytes, endpoint, apiKey, fallbackMeta);
        // Apply non-veg resolution first
        let resolvedFallback = applyNonVegResolution('Fallback', fallbackResult, fallbackMeta);
        // If still empty, try non-veg fallback first (cephalopod), then veg-only
        if (resolvedFallback.length === 0) {
            const cephalopodFallback = resolveCephalopodFromVision(fallbackMeta.tags, fallbackMeta.captions);
            if (cephalopodFallback) {
                console.log('🥩 Non-veg cephalopod canonical (Fallback):', cephalopodFallback.name);
                const finalResult = [{
                        name: cephalopodFallback.name,
                        score: cephalopodFallback.score
                    }];
                logFinalResult('Fallback Non-Veg', finalResult);
                return finalResult;
            }
            const vegFallback = finalizeVegFruitFromTags(fallbackMeta.tags || [], null);
            if (vegFallback && vegFallback.length > 0) {
                console.log(`🎉 FINAL RESULT (Fallback VEG):`);
                vegFallback.forEach((item, idx) => {
                    console.log(`  ${idx + 1}. ${item.name}: ${(item.score * 100).toFixed(1)}%`);
                });
                console.log('╚═══════════════════════════════════════════╝\n');
                return vegFallback;
            }
            console.log('\n❌ NO INGREDIENTS DETECTED');
            console.log('╚═══════════════════════════════════════════╝\n');
            return [];
        }
        // We have some result – check if it's non-veg
        const isNonVeg = resolvedFallback.some(r => {
            const name = r.name.toLowerCase();
            return ['meat', 'fish', 'seafood', 'chicken', 'mutton', 'lamb', 'beef', 'pork',
                'goat', 'turkey', 'duck', 'shrimp', 'prawn', 'lobster', 'crab',
                'octopus', 'squid'].includes(name);
        });
        // For veg/fruit, apply canonical name resolution from tags
        if (!isNonVeg) {
            const normalized = finalizeVegFruitFromTags(fallbackMeta.tags || [], resolvedFallback);
            const vegFinal = finalizeVegOutput(normalized, fallbackMeta.tags, 'Fallback');
            if (vegFinal && vegFinal.length > 0) {
                return vegFinal;
            }
        }
        else {
            const cephalopod = resolveCephalopodFromVision(fallbackMeta.tags, fallbackMeta.captions);
            if (cephalopod) {
                console.log('🥩 Non-veg cephalopod canonical (Fallback):', cephalopod.name);
                resolvedFallback = [{
                        name: cephalopod.name,
                        score: Math.max(cephalopod.score, resolvedFallback[0]?.score ?? cephalopod.score)
                    }];
            }
        }
        logFinalResult('Fallback', resolvedFallback);
        return resolvedFallback;
    }
    catch (error) {
        console.error('❌ Detection error:', error);
        throw error;
    }
}

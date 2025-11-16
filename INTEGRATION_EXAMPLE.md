# Best One Picker - Integration Guide

## Quick Start

The `bestOne` module is a **post-processing layer** that runs after Azure Vision detection. It takes the raw Azure output and picks exactly ONE best ingredient.

---

## Integration Steps

### Step 1: Import the Module

```typescript
import { pickBestOne } from './vision/bestOne'
```

### Step 2: Call After Azure Detection

```typescript
// Your existing Azure Vision call
const azureResult = await callAzureVision(imageBytes)

// Add bestOne post-processing
const ingredient = pickBestOne(azureResult)

if (ingredient) {
  console.log(`Detected: ${ingredient}`)
  // Use the single ingredient
} else {
  console.log('No ingredient detected')
}
```

---

## Full Example: Pantry Screen

### Before (Multiple Results)

```javascript
// src/screens/Pantry.js (OLD)
import { detectIngredients } from '../vision/imageScanning'

const handleScan = async (imageUri) => {
  const ingredients = await detectIngredients(imageUri)
  // ingredients = ["chicken", "meat", "poultry"] ❌ Multiple results
  
  Alert.alert(
    'Ingredients Detected',
    ingredients.join(', '),
    [{ text: 'OK' }]
  )
}
```

### After (Single Best Result)

```javascript
// src/screens/Pantry.js (NEW)
import { pickBestOne } from '../vision/bestOne'
import Constants from 'expo-constants'

const handleScan = async (imageUri) => {
  // 1. Convert image to base64
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  })

  // 2. Call Azure Vision
  const endpoint = Constants.expoConfig.extra.azureVisionEndpoint
  const apiKey = Constants.expoConfig.extra.azureVisionKey
  
  const response = await fetch(
    `${endpoint}/computervision/imageanalysis:analyze?features=objects,tags,denseCaptions&model-version=latest&api-version=2024-02-01`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Ocp-Apim-Subscription-Key': apiKey,
      },
      body: Buffer.from(base64, 'base64'),
    }
  )

  const azureResult = await response.json()

  // 3. Use bestOne picker
  const ingredient = pickBestOne(azureResult)
  // ingredient = "chicken" ✅ Single result

  if (ingredient) {
    Alert.alert(
      'Ingredient Detected',
      `Is this ${ingredient}?`,
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Yes', 
          onPress: () => {
            // Add to pantry
            addIngredient(ingredient)
          }
        }
      ]
    )
  } else {
    Alert.alert('No ingredient detected', 'Please try again')
  }
}
```

---

## Option 2: Wrapper Function

Create a reusable wrapper:

```typescript
// src/vision/detectSingle.ts
import { pickBestOne } from './bestOne'
import Constants from 'expo-constants'
import * as FileSystem from 'expo-file-system'

export async function detectSingleIngredient(imageUri: string): Promise<string | null> {
  try {
    // 1. Convert image to base64
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    })

    // 2. Call Azure Vision
    const endpoint = Constants.expoConfig.extra.azureVisionEndpoint
    const apiKey = Constants.expoConfig.extra.azureVisionKey
    
    const response = await fetch(
      `${endpoint}/computervision/imageanalysis:analyze?features=objects,tags,denseCaptions&model-version=latest&api-version=2024-02-01`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Ocp-Apim-Subscription-Key': apiKey,
        },
        body: Buffer.from(base64, 'base64'),
      }
    )

    if (!response.ok) {
      throw new Error(`Azure API error: ${response.status}`)
    }

    const azureResult = await response.json()

    // 3. Pick best one
    return pickBestOne(azureResult)
    
  } catch (error) {
    console.error('Detection error:', error)
    return null
  }
}
```

### Usage in Screen

```javascript
// src/screens/Pantry.js
import { detectSingleIngredient } from '../vision/detectSingle'

const handleScan = async (imageUri) => {
  const ingredient = await detectSingleIngredient(imageUri)
  
  if (ingredient) {
    Alert.alert(
      'Ingredient Detected',
      `Is this ${ingredient}?`,
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', onPress: () => addIngredient(ingredient) }
      ]
    )
  } else {
    Alert.alert('No ingredient detected', 'Please try again')
  }
}
```

---

## Option 3: Conditional Usage

Keep both multi-result and single-result modes:

```javascript
// src/screens/Pantry.js
import { detectIngredients } from '../vision/robustDetector'
import { detectSingleIngredient } from '../vision/detectSingle'

const handleScan = async (imageUri, mode = 'single') => {
  if (mode === 'single') {
    // Single-item mode (new)
    const ingredient = await detectSingleIngredient(imageUri)
    
    if (ingredient) {
      Alert.alert(
        'Ingredient Detected',
        `Is this ${ingredient}?`,
        [
          { text: 'No', style: 'cancel' },
          { text: 'Yes', onPress: () => addIngredient(ingredient) }
        ]
      )
    }
  } else {
    // Multi-item mode (existing)
    const ingredients = await detectIngredients(imageUri)
    
    if (ingredients.length > 0) {
      Alert.alert(
        'Ingredients Detected',
        ingredients.map(i => i.name).join(', '),
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add All', onPress: () => addIngredients(ingredients) }
        ]
      )
    }
  }
}
```

---

## Testing Integration

### Test with Mock Data

```javascript
// Test in your screen
const testBestOne = () => {
  const mockAzureResult = {
    tagsResult: {
      values: [
        { name: 'chicken', confidence: 0.92 },
        { name: 'meat', confidence: 0.78 }
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

  const result = pickBestOne(mockAzureResult)
  console.log('Test result:', result) // Should be "chicken"
}
```

---

## Expected Behavior

### ✅ Good Cases

| Input Image | Azure Tags | Best One Output |
|------------|------------|-----------------|
| Chicken photo | chicken, meat, poultry | `"chicken"` |
| Mutton pieces | mutton, meat | `"mutton"` |
| Shrimp | shrimp, fish, seafood | `"shrimp"` |
| Octopus | octopus, fish | `"octopus"` |
| Mango | mango, fruit | `"mango"` |
| Tomato | tomato, vegetable | `"tomato"` |

### ❌ Filtered Out

These will NOT be returned (generic terms):
- `"food"`
- `"meat"`
- `"seafood"`
- `"produce"`
- `"animal"`
- `"close"`
- `"red"`, `"green"`, etc. (colors)

---

## Logging

The module provides detailed console logs:

```
╔═══════════════════════════════════════════╗
║  🎯 BEST ONE PICKER (Post-Processing)   ║
╚═══════════════════════════════════════════╝
📋 Extracted: 3 tag tokens, 1 caption tokens, 1 object tokens
🎯 Valid candidates: 3

📊 Top candidates:
  1. chicken: 0.956 (tag:0.92 cap:1.00 cons:1.0 groups:3)
  2. meat: 0.429 (tag:0.78 cap:0.00 cons:0.0 groups:1)
  3. poultry: 0.358 (tag:0.65 cap:0.00 cons:0.0 groups:1)
  ✅ Winner: chicken (score: 0.956)
╚═══════════════════════════════════════════╝
```

To disable logs in production:

```typescript
// In bestOne.ts, comment out console.log statements
// Or wrap them:
const DEBUG = __DEV__ // React Native
if (DEBUG) console.log(...)
```

---

## Troubleshooting

### Issue: Returns `null`

**Possible causes:**
1. Azure returned only generic terms (food, meat, etc.)
2. All tokens were too short (< 3 chars)
3. All tokens were caption-only (not in tags/objects)

**Solution:**
- Check Azure response quality
- Ensure image is clear and well-lit
- Try different angle/distance

### Issue: Wrong ingredient detected

**Possible causes:**
1. Azure misclassified the item
2. Multiple items in frame

**Solution:**
- Use clearer, single-item photos
- Better lighting
- Closer crop

### Issue: Multiple results still appearing

**Possible causes:**
1. Still using old `detectIngredients` function
2. Not using `pickBestOne`

**Solution:**
- Ensure you're calling `pickBestOne(azureResult)`
- Check import statements

---

## Performance

- **Execution time:** < 10ms (post-processing only)
- **No extra API calls:** Uses existing Azure result
- **Memory:** Minimal (processes in-memory data)

---

## Next Steps

1. ✅ Import `pickBestOne` in your screen
2. ✅ Call it after Azure Vision detection
3. ✅ Test with real images
4. ✅ Deploy to production

**You're all set!** 🚀


/**
 * Multi-Object Refinement Layer
 * 
 * Runs a secondary crop-based analysis when Azure returns:
 * - Multiple objects (>1)
 * - Generic object classes (food, fruit, vegetable)
 * 
 * This helps distinguish between multiple items in the same image
 * (e.g., tomato + potato) by analyzing each bounding box separately.
 * 
 * Does NOT modify existing detectors - only runs as a refinement pass.
 */

import * as ImageManipulator from 'expo-image-manipulator'
import { canonicalizeIngredients } from './canonicalize'

// ==================== TYPES ====================

export type BBox = {
  x: number
  y: number
  w: number
  h: number
  conf: number
  name: string
}

export type AzureAnalysisResult = {
  tags?: Array<{ name: string; confidence: number }>
  denseCaptionsResult?: {
    values: Array<{ text: string; confidence: number }>
  }
}

// ==================== CONFIGURATION ====================

const GENERIC = new Set(['food', 'fruit', 'vegetable', 'produce'])
const MIN_CONF = 0.40 // Per-crop acceptance threshold
const MAX_REFINES = 4 // Latency guard (max crops to analyze)
const IOU_LIMIT = 0.2 // Keep distinct boxes (low overlap)
const CROP_MAX_SIDE = 512 // Max dimension for crop (speed optimization)

// ==================== UTILITIES ====================

/**
 * Calculate IoU (Intersection over Union) between two bounding boxes
 */
function iou(a: BBox, b: BBox): number {
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w)
  const y2 = Math.min(a.y + a.h, b.y + b.h)
  
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const areaA = a.w * a.h
  const areaB = b.w * b.h
  const uni = areaA + areaB - inter
  
  return uni ? inter / uni : 0
}

/**
 * Non-Maximum Suppression (NMS) for distinct items
 * Keeps boxes with low overlap (< IOU_LIMIT)
 */
export function keepDistinct(boxes: BBox[]): BBox[] {
  const out: BBox[] = []
  
  // Sort by confidence (descending)
  const sorted = [...boxes].sort((a, b) => b.conf - a.conf)
  
  for (const box of sorted) {
    // Keep if it doesn't overlap significantly with any kept box
    if (out.every(kept => iou(kept, box) < IOU_LIMIT)) {
      out.push(box)
    }
    
    // Latency guard: stop at MAX_REFINES
    if (out.length >= MAX_REFINES) {
      break
    }
  }
  
  return out
}

/**
 * Crop image to bounding box with padding
 */
async function cropJpeg(
  imageUri: string,
  box: BBox,
  imageWidth: number,
  imageHeight: number
): Promise<string> {
  try {
    // Add 5% padding
    const padding = Math.max(box.w, box.h) * 0.05
    
    const cropX = Math.max(0, box.x - padding)
    const cropY = Math.max(0, box.y - padding)
    const cropW = Math.min(imageWidth - cropX, box.w + 2 * padding)
    const cropH = Math.min(imageHeight - cropY, box.h + 2 * padding)
    
    // Crop and resize to max 512px for speed
    const actions: ImageManipulator.Action[] = [
      {
        crop: {
          originX: cropX,
          originY: cropY,
          width: cropW,
          height: cropH
        }
      }
    ]
    
    // Resize if needed
    const maxDim = Math.max(cropW, cropH)
    if (maxDim > CROP_MAX_SIDE) {
      actions.push({
        resize: {
          width: cropW > cropH ? CROP_MAX_SIDE : undefined,
          height: cropH > cropW ? CROP_MAX_SIDE : undefined
        }
      })
    }
    
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      actions,
      {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG
      }
    )
    
    return result.uri
  } catch (error) {
    console.warn('⚠️  Crop failed:', error)
    throw error
  }
}

/**
 * Extract best candidate from crop analysis
 */
function extractBestCandidate(
  result: AzureAnalysisResult
): string | null {
  const candidates: Array<{ name: string; confidence: number }> = []
  
  // Collect tags
  if (result.tags) {
    for (const tag of result.tags) {
      if (tag.confidence >= MIN_CONF) {
        candidates.push({ name: tag.name, confidence: tag.confidence })
      }
    }
  }
  
  // Collect from dense captions (fallback)
  if (result.denseCaptionsResult?.values && candidates.length === 0) {
    for (const caption of result.denseCaptionsResult.values) {
      if (caption.confidence >= 0.4) {
        // Extract potential food words from caption
        const words = caption.text.toLowerCase().split(/\s+/)
        for (const word of words) {
          const cleaned = word.replace(/[^\w]/g, '')
          if (cleaned.length >= 3) {
            candidates.push({ name: cleaned, confidence: caption.confidence })
          }
        }
      }
    }
  }
  
  if (candidates.length === 0) {
    return null
  }
  
  // Sort by confidence and get names
  const names = candidates
    .sort((a, b) => b.confidence - a.confidence)
    .map(c => c.name)
  
  // Canonicalize to get standard headword
  const canonical = canonicalizeIngredients(names)
  
  return canonical[0] || null
}

// ==================== MAIN REFINEMENT FUNCTION ====================

/**
 * Run secondary crop-based analysis for multi-object or generic detections
 * 
 * @param imageUri - Original image URI
 * @param objects - Detected bounding boxes from Azure
 * @param imageWidth - Image width
 * @param imageHeight - Image height
 * @param analyzeCrop - Function to analyze a crop (Azure call)
 * @returns Array of refined ingredient names, or null if refinement not needed
 */
export async function refineMulti({
  imageUri,
  objects,
  imageWidth,
  imageHeight,
  analyzeCrop
}: {
  imageUri: string
  objects: BBox[]
  imageWidth: number
  imageHeight: number
  analyzeCrop: (cropUri: string) => Promise<AzureAnalysisResult>
}): Promise<string[] | null> {
  try {
    // Only trigger when multi-object or generic
    const hasMulti = objects.length > 1
    const hasGeneric = objects.some(o => GENERIC.has(o.name.toLowerCase()))
    
    if (!hasMulti && !hasGeneric) {
      console.log('🔍 Refinement: Not needed (single specific object)')
      return null // Let core result stand
    }
    
    console.log(`🔍 Refinement: Triggered (${objects.length} objects, hasGeneric: ${hasGeneric})`)
    
    // Keep distinct boxes (NMS)
    const chosen = keepDistinct(objects)
    console.log(`🔍 Refinement: Analyzing ${chosen.length} distinct crops`)
    
    const heads: string[] = []
    
    // Analyze each crop
    for (let i = 0; i < chosen.length; i++) {
      const box = chosen[i]
      
      try {
        console.log(`🔍 Refinement: Crop ${i + 1}/${chosen.length} - "${box.name}" (conf: ${box.conf.toFixed(3)})`)
        
        // 1) Crop image
        const cropUri = await cropJpeg(imageUri, box, imageWidth, imageHeight)
        
        // 2) Quick Azure call on crop (tags + denseCaptions only)
        const result = await analyzeCrop(cropUri)
        
        // 3) Extract best candidate and canonicalize
        const candidate = extractBestCandidate(result)
        
        if (candidate) {
          console.log(`   ✅ Found: "${candidate}"`)
          heads.push(candidate)
        } else {
          console.log(`   ⚠️  No valid candidate found`)
        }
      } catch (error) {
        console.warn(`   ⚠️  Crop ${i + 1} failed:`, error)
        // Continue with other crops
      }
    }
    
    // Deduplicate while preserving order
    const unique = [...new Set(heads)]
    
    console.log(`🔍 Refinement: Final result - ${unique.length} items:`, unique)
    
    return unique.length > 0 ? unique : null
    
  } catch (error) {
    console.error('❌ Refinement error:', error)
    return null // Fallback to core result
  }
}


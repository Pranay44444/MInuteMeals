import Constants from 'expo-constants'

export const getApiKey = ()=>{
  const key = Constants.expoConfig?.extra?.spoonacularApiKey || 
              Constants.manifest?.extra?.spoonacularApiKey ||
              process.env.SPOONACULAR_API_KEY || 
              null
  
  if (key && key.length < 20){
    console.warn('Invalid API key format detected')
    return null
  }
  return key
}

export const hasKey = () => {
  return getApiKey() !== null
}

export const checkKey = (key) => {
  if (!key || typeof key !== 'string') return false
  return key.length >= 20 && key.length <= 50 && /^[a-zA-Z0-9]+$/.test(key)
}

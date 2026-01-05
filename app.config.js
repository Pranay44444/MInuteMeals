import 'dotenv/config'

export default {
  expo: {
    name: "MinuteMeals",
    slug: "MinuteMeals",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    plugins: ["expo-router", "expo-web-browser"],
    extra: {
      spoonacularApiKey: process.env.SPOONACULAR_API_KEY,
      geminiApiKey: process.env.GEMINI_API_KEY,
      apiUrl: process.env.API_URL || 'http://localhost:3000',
      azureVisionEndpoint: process.env.AZURE_VISION_ENDPOINT || 'https://minutemeals-vision.cognitiveservices.azure.com',
      azureVisionKey: process.env.AZURE_VISION_KEY,
      eas: {
        projectId: "70c64346-e14e-432b-b114-44d5e20b6d73"
      }
    },
    updates: {
      url: "https://u.expo.dev/70c64346-e14e-432b-b114-44d5e20b6d73"
    },
    runtimeVersion: {
      policy: "appVersion"
    },
    splash: { image: "./assets/splash-icon.png", resizeMode: "contain", backgroundColor: "#ffffff" },
    ios: { supportsTablet: true, bundleIdentifier: "com.pranay456.minutemeals" },
    android: { adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#ffffff" }, edgeToEdgeEnabled: true, package: "com.pranay456.minutemeals" },
    web: { favicon: "./assets/favicon.png" }
  }
}

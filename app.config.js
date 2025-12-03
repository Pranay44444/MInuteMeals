import 'dotenv/config';

export default {
  expo: {
    name: "MinuteMeals",
    slug: "MinuteMeals",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    plugins: [
      "expo-router",
      "expo-web-browser"
    ],
    extra: {
      spoonacularApiKey: process.env.SPOONACULAR_API_KEY,
      geminiApiKey: process.env.GEMINI_API_KEY,
      azureVisionEndpoint: process.env.AZURE_VISION_ENDPOINT || 'https://minutemeals-vision.cognitiveservices.azure.com',
      azureVisionKey: process.env.AZURE_VISION_KEY
    },
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true
    },
    web: {
      favicon: "./assets/favicon.png"
    }
  }
};

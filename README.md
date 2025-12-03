# MinuteMeals 🍲
[![React Native](https://img.shields.io/badge/React%20Native-JavaScript-blue)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-Ready-000?logo=expo)](https://expo.dev/)
[![Platform](https://img.shields.io/badge/Android%20%7C%20iOS%20%7C%20Web-supported-success)]()

## 🎥 [Watch Demo Video](https://drive.google.com/file/d/1XuUuEkax09q5R2bZPG2p30YCtBQ1SUr8/view?usp=drivesdk)

Cook fast with what you already have. MinuteMeals matches your pantry to **quick recipes** using AI, shows what you can cook **now**, and builds a shopping list for missing items.  
> **React Native + Expo** (Mobile + Web) with **Node.js backend**, **MongoDB**, **Google Gemini AI** for recipes, and **Azure Vision** for ingredient scanning.

---

## 1. Project Title
**MinuteMeals — Pantry-Based Quick Recipes App**

---

## 2. Name & Roll Number
**Pranay Chitare — 2024-B-16102004**

---

## 3. Problem Statement
People waste time deciding what to cook and often skip simple meals they could make with ingredients already at home. Typical recipe apps assume you have everything and don’t reflect your **actual pantry**.

---

## 4. Proposed Solution / Idea
A **React Native + Expo** app with **Node.js backend** that:
- Lets users select what's in their **pantry** or **scan ingredients** using Azure Vision AI,
- Generates **personalized recipes** using Google Gemini AI based on available ingredients,
- Shows **Cook Now** recipes (all ingredients available) or **Missing items** for partial matches,
- Creates a **shopping list** for missing ingredients with smart quantity merging,
- Requires **internet connection** for AI recipe generation and ingredient scanning.

---

## 5. Key Features
- ✅ Pantry picker (search + checkboxes)  
- ✅ **AI-powered ingredient scanning** using Azure Vision
- ✅ **Smart recipe generation** using Google Gemini AI based on your pantry
- ✅ Instant match: **Cook Now** or **Missing items**  
- ✅ One-tap **Add to Shopping List** (merge quantities)  
- ✅ Filters: veg/non-veg • max time • cuisine • difficulty  
- ✅ Favorites & shareable recipe cards  
- ✅ User authentication and personalized pantry management

---

## 6. Target Users / Audience
Students, working professionals, hostels/PGs, busy families—anyone who wants **fast, simple** home-cooking.

---

## 7. Technology Stack
**Frontend:**
- React Native + **Expo** (Android • iOS • Web)

**Backend:**
- **Node.js** (Express)
- **DataBase:** MongoDB Atlas (Mongoose)
- **Find Recipes:** Google Gemini 2.5 Flash Lite
- **Scan Items:** Azure Vision
- **Tools:** ngrok (Tunneling)

---

## 8. Expected Outcome
- Generate **personalized recipes** using AI based on available ingredients
- Clear **Cook Now** vs **Missing items** decisions with match percentages
- **Ingredient scanning** from photos using computer vision
- Simple shopping list flow with smart quantity merging
- Favorites & sharing functionality

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v16+)
- npm or yarn
- Expo CLI
- MongoDB Atlas account (free tier)
- Google Gemini API key
- Azure Vision API credentials

### Installation

```bash
# Clone
git clone https://github.com/Pranay44444/MInuteMeals.git
cd MinuteMeals

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### Configuration

Create `app.json` in the root directory with your API keys:
```json
{
  "expo": {
    "extra": {
      "geminiApiKey": "YOUR_GEMINI_API_KEY",
      "azureVisionEndpoint": "YOUR_AZURE_ENDPOINT",
      "azureVisionKey": "YOUR_AZURE_KEY",
      "backendUrl": "http://localhost:3000"
    }
  }
}
```

### Running the App

```bash
# Terminal 1: Start backend
cd backend
node server.js

# Terminal 2: Start Expo (mobile)
npx expo start           # press 'a' for Android or 'i' for iOS

# Or run on web
npx expo start --web
```

### For Development with Real Device
Use ngrok to expose your local backend:
```bash
# Terminal 3: Expose backend
ngrok http 3000
# Update app.json backendUrl with ngrok URL
```

## 👨‍💻 Made with ❤️ by

[Pranay Chitare](https://github.com/Pranay44444)

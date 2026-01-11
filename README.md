# MinuteMeals 🍲
[![React Native](https://img.shields.io/badge/React%20Native-0.70+-61DAFB?logo=react&logoColor=white)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-51+-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS%20%7C%20Web-success)]()

### **Cook fast with what you already have.**
MinuteMeals is an intelligent recipe assistant that matches your **existing pantry** to **quick recipes** using AI. It identifies what you can cook **right now**, generates shopping lists for missing items, and helps you reduce food waste.

---

## ✨ Key Features

*   **🧠 AI Chef (Gemini 2.5)**: Generates creative, personalized recipes based *exactly* on your ingredients.
*   **📸 Smart Vision (Azure)**: Snap a photo of your fridge or pantry to auto-detect ingredients.
*   **🥘 Cook Now**: Instantly see recipes you can make with 0 shopping.
*   **🛒 One-Tap Shopping**: Automatically adds missing ingredients to your shopping list with smart quantity merging.
*   **🌐 PWA Support**: Installable on **Android, iOS, and Desktop** directly from the browser with offline capabilities.
*   **📱 Native Android App**: High-performance compiled APK for Android devices.

---

## 🛠️ Technology Stack

| Component | Technology |
|:--- |:--- |
| **Frontend** | React Native, Expo, React Navigation |
| **Web / PWA** | React Native Web, Expo Router, Service Workers |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB Atlas (Mongoose) |
| **AI Engine** | Google Gemini 2.5 Flash Lite |
| **Vision** | Azure Computer Vision |
| **Distribution** | EAS Build (APK), Vercel/Render (Web) |

---

## 🚀 Getting Started

### 1. Download the App
*   **Android (APK)**: [Download Latest Release](https://github.com/Pranay44444/MInuteMeals/releases/latest)
*   **Web (PWA)**: Visit the deployed URL (e.g., `https://minutemeals.onrender.com`) and click **"Install App"**.

### 2. Local Development

#### Prerequisites
*   Node.js (v18+)
*   Expo CLI
*   MongoDB Atlas Account
*   Google Gemini & Azure Vision Keys

#### Installation
```bash
# Clone the repository
git clone https://github.com/Pranay44444/MInuteMeals.git
cd MinuteMeals

# Install dependencies
npm install
cd backend && npm install && cd ..
```

#### Configuration
Create a `secrets.js` or configure `app.config.js` with your keys:
```javascript
export default {
  extra: {
    geminiApiKey: "YOUR_GEMINI_KEY",
    azureVisionKey: "YOUR_AZURE_KEY",
    azureVisionEndpoint: "YOUR_AZURE_ENDPOINT",
    backendUrl: "http://localhost:3000" // or your simple IP
  }
}
```

#### Run the App
```bash
# Start Backend
cd backend
node server.js

# Start Frontend (in a new terminal)
npx expo start
# Press 'a' for Android, 'w' for Web
```

---

## 🤝 Contributing
Contributions are welcome! Please fork the repository and submit a pull request.

## 👨‍💻 Author
**Pranay Chitare**
[GitHub](https://github.com/Pranay44444)

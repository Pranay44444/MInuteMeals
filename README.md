# MinuteMeals 🍲
[![React Native](https://img.shields.io/badge/React%20Native-JavaScript-blue)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-Ready-000?logo=expo)](https://expo.dev/)
[![Platform](https://img.shields.io/badge/Android%20%7C%20iOS%20%7C%20Web-supported-success)]()

Cook fast with what you already have. MinuteMeals matches your pantry to **10–15 minute** recipes, shows what you can cook **now**, and (optionally) builds a shopping list for missing items.  
> **JS-only**. Mobile + Web via Expo. Future backend: **Node.js + SQL**.

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
A **React Native + Expo** app (JS) that:
- Lets users select what’s in their **pantry** (or scan the fridge in future),
- Instantly matches **cookable recipes** within 10–15 minutes,
- Shows **missing items** and creates an **optional shopping list**,
- Works **offline** with a small recipe dataset, and **scales** later via Node.js + DB.

---

## 5. Key Features
- ✅ Pantry picker (search + checkboxes)  
- ✅ Instant match: **Cook Now** or **Missing items (required/optional)**  
- ✅ One-tap **Add to Shopping List** (merge quantities)  
- ✅ Filters: veg/non-veg • max time • cuisine • difficulty  
- ✅ Favorites & shareable recipe cards  
- ✅ Offline-first with local `recipes.json` (Web + Mobile)

---

## 6. Target Users / Audience
Students, working professionals, hostels/PGs, busy families—anyone who wants **fast, simple** home-cooking.

---

## 7. Technology Stack
**Now (JavaScript only):**
- React Native + **Expo** (Android • iOS • Web)

**Future (Backend & CV):**
- **Node.js** (Express)  
- **DB:** MySQL (Prisma)  
- Storage: S3/GCS for images  
- **Scan Items(optional):** Google Vision / Azure Vision

---

## 8. Expected Outcome
- Suggest suitable recipes in **less than 1sec**
- Clear **Cook Now** vs **Missing items** decisions  
- Simple shopping list flow; favorites & sharing

---

## 9. Timeline (Optional)
- **Week 1–2:** UI/UX, pantry, local `recipes.json`, matching  
- **Week 3–4:** favorites, shopping list, filters, web build  
- **Week 5–6:** Node API + DB sync, auth (optional)  
- **Week 7:** scan items + testing

---

## 🚀 Quick Start
```bash
# Clone
git clone https://github.com/Pranay44444/MInuteMeals.git

# Install (JS-only)
npm i
npx expo install expo-sqlite expo-image expo-file-system expo-share expo-notifications


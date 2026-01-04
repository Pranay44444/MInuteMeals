import React from 'react'
import { Image } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { StoreProvider } from './src/services/store'
import Matches from './src/screens/Matches'
import Pantry from './src/screens/Pantry'
import ShoppingList from './src/screens/ShoppingList'
import Favorites from './src/screens/Favorites'
import Settings from './src/screens/Settings'
import RecipeDetail from './src/screens/RecipeDetail'
import AppShell from './src/components/AppShell'

const basketIcon = require('./assets/icons/basket.png')
const Tab = createBottomTabNavigator()
const Stack = createStackNavigator()

function MatchesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MatchesMain" component={Matches} />
      <Stack.Screen name="RecipeDetail" component={RecipeDetail} />
    </Stack.Navigator>
  )
}

function PantryStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PantryMain" component={Pantry} />
      <Stack.Screen name="RecipeDetail" component={RecipeDetail} />
    </Stack.Navigator>
  )
}

function ShoppingStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ShoppingMain" component={ShoppingList} />
      <Stack.Screen name="RecipeDetail" component={RecipeDetail} />
    </Stack.Navigator>
  )
}

function FavoritesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FavoritesMain" component={Favorites} />
      <Stack.Screen name="RecipeDetail" component={RecipeDetail} />
    </Stack.Navigator>
  )
}

function Tabs() {
  return (
    <Tab.Navigator screenOptions={{ tabBarActiveTintColor: '#007AFF', tabBarInactiveTintColor: '#666', headerShown: false, tabBarIconStyle: { width: 24, height: 24 } }}>
      <Tab.Screen name="Matches" component={MatchesStack} options={{ tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} /> }} />
      <Tab.Screen name="Pantry" component={PantryStack} options={{ tabBarIcon: ({ color }) => <Ionicons name="basket" size={24} color={color} /> }} />
      <Tab.Screen name="Shopping" component={ShoppingStack} options={{ tabBarIcon: ({ color }) => <Ionicons name="list" size={24} color={color} /> }} />
      <Tab.Screen name="Favorites" component={FavoritesStack} options={{ tabBarIcon: ({ color }) => <Ionicons name="heart" size={24} color={color} /> }} />
      <Tab.Screen name="Settings" component={Settings} options={{ tabBarIcon: ({ color }) => <Ionicons name="settings" size={24} color={color} /> }} />
    </Tab.Navigator>
  )
}

export default function App() {
  return (
    <AppShell>
      <StoreProvider>
        <NavigationContainer>
          <Tabs />
        </NavigationContainer>
      </StoreProvider>
    </AppShell>
  )
}

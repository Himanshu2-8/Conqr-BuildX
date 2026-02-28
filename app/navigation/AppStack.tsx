import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { HomeScreen } from "../HomeScreen";
import { RunScreen } from "../RunScreen";
import { LeaderboardScreen } from "../Leaderboard";
import { QuestsScreen } from "../Quests";
import { ProfileScreen } from "../Profile";

const Stack = createNativeStackNavigator();

export function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#000000" },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "900", fontSize: 20 },
        headerTitleAlign: "left",
        headerShadowVisible: false,
        contentStyle: { backgroundColor: "#000000" },
        animation: "fade_from_bottom",
        animationDuration: 260,
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Dashboard", headerShown: false }} />
      <Stack.Screen name="Quests" component={QuestsScreen} options={{ title: "Quests" }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
      <Stack.Screen name="Run" component={RunScreen} options={{ title: "Live Run", headerShown: false }} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: "Leaderboard" }} />
    </Stack.Navigator>
  );
}

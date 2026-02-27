import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { HomeScreen } from "../HomeScreen";
import { RunScreen } from "../RunScreen";
import { LeaderboardScreen } from "../Leaderboard";
import { QuestsScreen } from "../Quests";

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
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Dashboard", headerShown: false }} />
      <Stack.Screen name="Quests" component={QuestsScreen} options={{ title: "Quests" }} />
      <Stack.Screen name="Run" component={RunScreen} options={{ title: "Live Run", headerShown: false }} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: "Leaderboard" }} />
    </Stack.Navigator>
  );
}

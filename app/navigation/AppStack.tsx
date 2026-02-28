import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View } from "react-native";

import { HomeScreen } from "../HomeScreen";
import { RunScreen } from "../RunScreen";
import { LeaderboardScreen } from "../Leaderboard";
import { QuestsScreen } from "../Quests";
import { ProfileScreen } from "../Profile";
import { MapPopScreen } from "../MapPop";
import { AppLogo } from "../ui/AppLogo";

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
        headerRight: () => (
          <View style={{ marginRight: 6 }}>
            <AppLogo width={44} height={24} />
          </View>
        ),
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Dashboard", headerShown: false }} />
      <Stack.Screen name="Quests" component={QuestsScreen} options={{ title: "Quests" }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
      <Stack.Screen name="Run" component={RunScreen} options={{ title: "Live Run", headerShown: false }} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: "Leaderboard" }} />
      <Stack.Screen
        name="MapPop"
        component={MapPopScreen}
        options={{ headerShown: false, presentation: "modal", animation: "slide_from_bottom" }}
      />
    </Stack.Navigator>
  );
}

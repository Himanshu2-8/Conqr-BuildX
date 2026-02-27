import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HomeScreen } from "../HomeScreen";
import { RunScreen } from "../RunScreen";

const Stack = createNativeStackNavigator();

export function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#0f172a" },
        headerTintColor: "#f8fafc",
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Dashboard" }} />
      <Stack.Screen name="Run" component={RunScreen} options={{ title: "Live Run" }} />
    </Stack.Navigator>
  );
}

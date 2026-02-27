import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen } from "../auth/LoginScreen";
import { SignupScreen } from "../auth/SignupScreen";

const Stack = createNativeStackNavigator();

export function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#000000" },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "800" },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Welcome" }} />
      <Stack.Screen name="Signup" component={SignupScreen} options={{ title: "Create account" }} />
    </Stack.Navigator>
  );
}

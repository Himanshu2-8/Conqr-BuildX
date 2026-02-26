import React from "react";
import { Button, Text, View } from "react-native";
import { useAuth } from "./context/AuthContext";

export function HomeScreen() {
  const { user, signOut } = useAuth();

  return (
    <View style={{ flex: 1, gap: 16, justifyContent: "center", alignItems: "center", padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>Logged in</Text>
      <Text>{user?.email}</Text>
      <Button title="Sign out" onPress={signOut} />
    </View>
  );
}

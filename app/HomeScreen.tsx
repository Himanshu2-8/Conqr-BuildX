import React from "react";
import { Button, Text, View } from "react-native";
import { useAuth } from "./context/AuthContext";
import { useNavigation } from "@react-navigation/native";

export function HomeScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<any>();

  return (
    <View style={{ flex: 1, gap: 16, justifyContent: "center", alignItems: "center", padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>Logged in</Text>
      <Text>{user?.email}</Text>
      <Button title="Start Run Tracking" onPress={() => navigation.navigate("Run")} />
      <Button title="Sign out" onPress={signOut} />
    </View>
  );
}

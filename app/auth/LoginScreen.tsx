import React, { useState } from "react";
import { Alert, Button, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";

export function LoginScreen() {
  const { signIn } = useAuth();
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    setLoading(true);
    const res = await signIn(email, password);
    setLoading(false);

    if (!res.success) {
      Alert.alert("Login failed", res.message ?? "Something went wrong");
    }
  };

  return (
    <View style={{ flex: 1, gap: 12, padding: 16, justifyContent: "center" }}>
      <Text style={{ fontSize: 24, fontWeight: "600" }}>Login</Text>
      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 }}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 }}
      />
      <Button title={loading ? "Logging in..." : "Login"} onPress={onLogin} disabled={loading} />
      <Button title="Create account" onPress={() => navigation.navigate("Signup")} />
    </View>
  );
}

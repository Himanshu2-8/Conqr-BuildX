import React, { useState } from "react";
import { Alert, Button, Text, TextInput, View } from "react-native";
import { useAuth } from "../context/AuthContext";

export function SignupScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  const onSignup = async () => {
    setLoading(true);
    const res = await signUp({ email, password, username });
    setLoading(false);

    if (!res.success) {
      Alert.alert("Signup failed", res.message ?? "Something went wrong");
      return;
    }

    Alert.alert("Success", "Account created.");
  };

  return (
    <View style={{ flex: 1, gap: 12, padding: 16, justifyContent: "center" }}>
      <Text style={{ fontSize: 24, fontWeight: "600" }}>Sign up</Text>
      <TextInput
        placeholder="Username (optional)"
        value={username}
        onChangeText={setUsername}
        style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 }}
      />
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
      <Button title={loading ? "Creating..." : "Create account"} onPress={onSignup} disabled={loading} />
    </View>
  );
}

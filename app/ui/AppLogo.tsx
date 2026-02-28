import React from "react";
import { Image, StyleSheet, View } from "react-native";

const logo = require("../assets/conqr-logo.png");

type AppLogoProps = {
  width?: number;
  height?: number;
};

export function AppLogo({ width = 84, height = 46 }: AppLogoProps) {
  return (
    <View style={[styles.wrap, { width, height, borderRadius: Math.min(14, Math.round(height / 3)) }]}>
      <Image source={logo} style={{ width, height }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    backgroundColor: "transparent",
  },
});


import React from "react";
import { StyleSheet, View } from "react-native";
import type { Region } from "react-native-maps";

// @ts-ignore react-native-svg is provided at runtime in Expo, even if local types are absent
const SvgModule = require("react-native-svg");
const Svg = SvgModule.default ?? SvgModule;
const { Defs, Ellipse, Mask, Polygon: SvgPolygon, RadialGradient, Rect, Stop } = SvgModule;

type MapCoordinate = {
  latitude: number;
  longitude: number;
};

type FogOverlayProps = {
  width: number;
  height: number;
  region: Region;
  revealPolygons?: MapCoordinate[][];
};

function toScreenPoint(point: MapCoordinate, region: Region, width: number, height: number) {
  const left = region.longitude - region.longitudeDelta / 2;
  const top = region.latitude + region.latitudeDelta / 2;
  const x = ((point.longitude - left) / region.longitudeDelta) * width;
  const y = ((top - point.latitude) / region.latitudeDelta) * height;
  return { x, y };
}

function toScreenPolygon(points: MapCoordinate[], region: Region, width: number, height: number) {
  return points
    .map((point) => {
      const screenPoint = toScreenPoint(point, region, width, height);
      return `${screenPoint.x},${screenPoint.y}`;
    })
    .join(" ");
}

function buildClouds(width: number, height: number) {
  return [
    { x: width * 0.18, y: height * 0.2, rx: width * 0.2, ry: height * 0.16, opacity: 0.28 },
    { x: width * 0.5, y: height * 0.14, rx: width * 0.22, ry: height * 0.14, opacity: 0.22 },
    { x: width * 0.78, y: height * 0.28, rx: width * 0.24, ry: height * 0.18, opacity: 0.24 },
    { x: width * 0.14, y: height * 0.62, rx: width * 0.22, ry: height * 0.18, opacity: 0.24 },
    { x: width * 0.52, y: height * 0.76, rx: width * 0.26, ry: height * 0.16, opacity: 0.22 },
    { x: width * 0.84, y: height * 0.72, rx: width * 0.18, ry: height * 0.14, opacity: 0.24 },
  ];
}

export function FogOverlay({ width, height, region, revealPolygons = [] }: FogOverlayProps) {
  if (width <= 0 || height <= 0) {
    return null;
  }

  const baseRadius = Math.max(Math.min(width, height) * 0.13, 42);
  const clouds = buildClouds(width, height);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="revealGrad" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="black" stopOpacity="1" />
            <Stop offset="40%" stopColor="rgb(24,24,24)" stopOpacity="0.82" />
            <Stop offset="72%" stopColor="rgb(170,170,170)" stopOpacity="0.42" />
            <Stop offset="100%" stopColor="white" stopOpacity="1" />
          </RadialGradient>
          <RadialGradient id="cloudGrad" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="rgb(255,255,255)" stopOpacity="0.68" />
            <Stop offset="60%" stopColor="rgb(225,225,225)" stopOpacity="0.42" />
            <Stop offset="100%" stopColor="rgb(185,185,185)" stopOpacity="0" />
          </RadialGradient>
          <Mask id="fogMask">
            <Rect x="0" y="0" width={width} height={height} fill="white" />
            {revealPolygons
              .filter((polygon) => polygon.length >= 3)
              .map((polygon, index) => (
                <SvgPolygon
                  key={`poly-${index}`}
                  points={toScreenPolygon(polygon, region, width, height)}
                  fill="black"
                />
              ))}
          </Mask>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="rgba(70,70,70,0.42)" mask="url(#fogMask)" />
        <Rect x="0" y="0" width={width} height={height} fill="rgba(220,220,220,0.58)" mask="url(#fogMask)" />
        {clouds.map((cloud, index) => (
          <Ellipse
            key={`cloud-${index}`}
            cx={cloud.x}
            cy={cloud.y}
            rx={cloud.rx}
            ry={cloud.ry}
            fill="url(#cloudGrad)"
            opacity={cloud.opacity}
            mask="url(#fogMask)"
          />
        ))}
        <Rect x="0" y="0" width={width} height={height} fill="rgba(255,255,255,0.22)" mask="url(#fogMask)" />
      </Svg>
    </View>
  );
}

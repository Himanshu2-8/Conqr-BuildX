import { useEffect, useRef } from "react";
import { Animated } from "react-native";

/**
 * Returns animated style values for a smooth fade + slide-up entrance.
 * @param delay   ms to wait before the animation starts
 * @param fromY   initial vertical offset (pixels, default 20)
 * @param duration animation duration in ms (default 380)
 */
export function useEntranceAnim(delay = 0, fromY = 20, duration = 380) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(fromY)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { opacity, transform: [{ translateY }] };
}

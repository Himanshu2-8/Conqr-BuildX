import { useCallback, useEffect, useMemo, useState } from "react";
import type { Region } from "react-native-maps";

import {
  buildFogRevealPoints,
  canRenderFog,
  countExploredTiles,
  type FogRevealPoint,
  isKnownFogTileId,
  loadExploredTiles,
  revealTilesAroundPoints,
  saveExploredTiles,
} from "../services/fogOfWar";

type MapCoordinate = {
  latitude: number;
  longitude: number;
};

function toKey(point: MapCoordinate) {
  return `${point.latitude.toFixed(5)}:${point.longitude.toFixed(5)}`;
}

export function useFogOfWar(userId: string | null | undefined, region: Region, extraVisiblePoints: MapCoordinate[] = []) {
  const [exploredTileIds, setExploredTileIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setExploredTileIds([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    loadExploredTiles(userId)
      .then((tileIds) => {
        if (!active) {
          return;
        }
        setExploredTileIds(tileIds.filter(isKnownFogTileId));
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const revealAroundPoints = useCallback(
    (points: MapCoordinate[]) => {
      if (!userId || points.length === 0) {
        return;
      }

      setExploredTileIds((prev) => {
        const next = revealTilesAroundPoints(points, prev);
        if (next.length === prev.length) {
          return prev;
        }
        void saveExploredTiles(userId, next);
        return next;
      });
    },
    [userId]
  );

  const revealPoints = useMemo(() => {
    const merged = new Map<string, FogRevealPoint>();
    buildFogRevealPoints(region, exploredTileIds).forEach((point) => {
      merged.set(toKey(point), point);
    });
    extraVisiblePoints.forEach((point) => {
      merged.set(toKey(point), point);
    });
    return Array.from(merged.values());
  }, [exploredTileIds, extraVisiblePoints, region]);

  return {
    revealPoints,
    fogEnabled: canRenderFog(region),
    exploredCount: countExploredTiles(exploredTileIds),
    loading,
    revealAroundPoints,
  };
}

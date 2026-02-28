import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Region } from "react-native-maps";

type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export type FogRevealPoint = {
  latitude: number;
  longitude: number;
};

const FOG_CELL_SIZE_DEGREES = 0.0012;
const FOG_REVEAL_RADIUS_CELLS = 1;
const FOG_VISIBLE_MARGIN_CELLS = 2;
const FOG_MAX_REVEAL_POINTS = 72;

function getStorageKey(userId: string) {
  return `conqr:fog:${userId}`;
}

function clampBounds(min: number, max: number) {
  return {
    min: Math.min(min, max),
    max: Math.max(min, max),
  };
}

function coordinateToGrid(coord: MapCoordinate) {
  return {
    row: Math.floor(coord.latitude / FOG_CELL_SIZE_DEGREES),
    col: Math.floor(coord.longitude / FOG_CELL_SIZE_DEGREES),
  };
}

function gridToTileId(row: number, col: number) {
  return `${row}:${col}`;
}

function tileIdToGrid(tileId: string) {
  const [rowText, colText] = tileId.split(":");
  const row = Number(rowText);
  const col = Number(colText);
  return { row, col };
}

export async function loadExploredTiles(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(getStorageKey(userId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export async function saveExploredTiles(userId: string, tileIds: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(tileIds));
  } catch {
    // Ignore cache failures. Fog-of-war should not block the app.
  }
}

export function revealTilesAroundPoints(points: MapCoordinate[], existingTileIds: Iterable<string>): string[] {
  const next = new Set(existingTileIds);

  points.forEach((point) => {
    const { row, col } = coordinateToGrid(point);
    for (let rowOffset = -FOG_REVEAL_RADIUS_CELLS; rowOffset <= FOG_REVEAL_RADIUS_CELLS; rowOffset += 1) {
      for (let colOffset = -FOG_REVEAL_RADIUS_CELLS; colOffset <= FOG_REVEAL_RADIUS_CELLS; colOffset += 1) {
        next.add(gridToTileId(row + rowOffset, col + colOffset));
      }
    }
  });

  return Array.from(next);
}

export function canRenderFog(_region: Region) {
  return true;
}

function toTileCenter(tileId: string) {
  const { row, col } = tileIdToGrid(tileId);
  return {
    latitude: row * FOG_CELL_SIZE_DEGREES + FOG_CELL_SIZE_DEGREES / 2,
    longitude: col * FOG_CELL_SIZE_DEGREES + FOG_CELL_SIZE_DEGREES / 2,
  };
}

function distanceScore(a: MapCoordinate, b: MapCoordinate) {
  return Math.abs(a.latitude - b.latitude) + Math.abs(a.longitude - b.longitude);
}

export function buildFogRevealPoints(region: Region, exploredTileIds: Iterable<string>): FogRevealPoint[] {
  const explored = new Set(exploredTileIds);
  const latBounds = clampBounds(
    region.latitude - region.latitudeDelta / 2,
    region.latitude + region.latitudeDelta / 2
  );
  const lngBounds = clampBounds(
    region.longitude - region.longitudeDelta / 2,
    region.longitude + region.longitudeDelta / 2
  );

  const minRow = Math.floor(latBounds.min / FOG_CELL_SIZE_DEGREES) - FOG_VISIBLE_MARGIN_CELLS;
  const maxRow = Math.ceil(latBounds.max / FOG_CELL_SIZE_DEGREES) + FOG_VISIBLE_MARGIN_CELLS;
  const minCol = Math.floor(lngBounds.min / FOG_CELL_SIZE_DEGREES) - FOG_VISIBLE_MARGIN_CELLS;
  const maxCol = Math.ceil(lngBounds.max / FOG_CELL_SIZE_DEGREES) + FOG_VISIBLE_MARGIN_CELLS;
  const regionCenter = { latitude: region.latitude, longitude: region.longitude };

  const visibleExploredCenters = Array.from(explored)
    .map((tileId) => ({ tileId, ...tileIdToGrid(tileId) }))
    .filter(({ row, col }) => row >= minRow && row <= maxRow && col >= minCol && col <= maxCol)
    .map(({ tileId }) => toTileCenter(tileId))
    .sort((a, b) => distanceScore(a, regionCenter) - distanceScore(b, regionCenter))
    .slice(0, FOG_MAX_REVEAL_POINTS);

  return visibleExploredCenters;
}

export function countExploredTiles(tileIds: Iterable<string>) {
  return new Set(tileIds).size;
}

export function isKnownFogTileId(tileId: string) {
  const { row, col } = tileIdToGrid(tileId);
  return Number.isFinite(row) && Number.isFinite(col);
}

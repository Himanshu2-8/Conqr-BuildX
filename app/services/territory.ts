import { collection, doc, documentId, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { TrackPoint } from "../hooks/useRunTracker";

type LatLngPoint = {
  latitude: number;
  longitude: number;
};

export type TerritoryState = {
  userId?: string;
  username?: string;
  coordinates: LatLngPoint[];
  areaM2: number;
  updatedAt?: number; // epoch ms – used to sort territories by recency for conquest rendering
};

const DEFAULT_BUFFER_METERS = 25;
const DEFAULT_CELL_SIZE_METERS = 10;
const MAX_POLYGON_POINTS = 600;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

type XY = { x: number; y: number };

function metersPerLngDegree(atLat: number) {
  return 111320 * Math.cos(toRadians(atLat));
}

function projectToXY(origin: LatLngPoint, point: LatLngPoint): XY {
  const mPerLng = metersPerLngDegree(origin.latitude);
  const dx = (point.longitude - origin.longitude) * (Math.abs(mPerLng) < 0.00001 ? 111320 : mPerLng);
  const dy = (point.latitude - origin.latitude) * 111320;
  return { x: dx, y: dy };
}

function unprojectToLatLng(origin: LatLngPoint, xy: XY): LatLngPoint {
  const mPerLng = metersPerLngDegree(origin.latitude);
  const lng = origin.longitude + xy.x / (Math.abs(mPerLng) < 0.00001 ? 111320 : mPerLng);
  const lat = origin.latitude + xy.y / 111320;
  return { latitude: lat, longitude: lng };
}

function computeXYBounds(points: XY[]) {
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, maxX, minY, maxY };
}

function distancePointToSegmentSq(p: XY, a: XY, b: XY) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq <= 0.0000001) {
    return apx * apx + apy * apy;
  }
  let t = (apx * abx + apy * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * abx;
  const cy = a.y + t * aby;
  const dx = p.x - cx;
  const dy = p.y - cy;
  return dx * dx + dy * dy;
}

function pointInPolygon(point: XY, polygon: XY[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects =
      yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 0.0) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function removeCollinear(points: XY[]) {
  if (points.length < 4) return points;
  const out: XY[] = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length];
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const cross = v1x * v2y - v1y * v2x;
    if (Math.abs(cross) > 0.000001) {
      out.push(curr);
    }
  }
  return out.length >= 4 ? out : points;
}

function downsample(points: XY[], maxPoints: number) {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const out: XY[] = [];
  for (let i = 0; i < points.length; i += step) {
    out.push(points[i]);
  }
  return out.length >= 4 ? out : points.slice(0, maxPoints);
}

type Grid = {
  originX: number;
  originY: number;
  cell: number;
};

function cellKey(i: number, j: number) {
  return `${i},${j}`;
}

function toCell(grid: Grid, p: XY) {
  const i = Math.floor((p.x - grid.originX) / grid.cell);
  const j = Math.floor((p.y - grid.originY) / grid.cell);
  return { i, j };
}

function cellCenter(grid: Grid, i: number, j: number): XY {
  return {
    x: grid.originX + (i + 0.5) * grid.cell,
    y: grid.originY + (j + 0.5) * grid.cell,
  };
}

function cellCorners(grid: Grid, i: number, j: number) {
  const x0 = grid.originX + i * grid.cell;
  const y0 = grid.originY + j * grid.cell;
  const x1 = x0 + grid.cell;
  const y1 = y0 + grid.cell;
  return { x0, y0, x1, y1 };
}

function rasterizeBufferedRoute(grid: Grid, route: XY[], bufferMeters: number): Set<string> {
  const occupied = new Set<string>();
  if (route.length < 2) {
    return occupied;
  }
  const rSq = bufferMeters * bufferMeters;
  for (let idx = 0; idx < route.length - 1; idx++) {
    const a = route[idx];
    const b = route[idx + 1];
    const minX = Math.min(a.x, b.x) - bufferMeters;
    const maxX = Math.max(a.x, b.x) + bufferMeters;
    const minY = Math.min(a.y, b.y) - bufferMeters;
    const maxY = Math.max(a.y, b.y) + bufferMeters;
    const start = toCell(grid, { x: minX, y: minY });
    const end = toCell(grid, { x: maxX, y: maxY });

    for (let i = start.i; i <= end.i; i++) {
      for (let j = start.j; j <= end.j; j++) {
        const center = cellCenter(grid, i, j);
        if (distancePointToSegmentSq(center, a, b) <= rSq) {
          occupied.add(cellKey(i, j));
        }
      }
    }
  }
  return occupied;
}

function rasterizePolygon(grid: Grid, polygon: XY[], into: Set<string>) {
  if (polygon.length < 3) return;
  const { minX, maxX, minY, maxY } = computeXYBounds(polygon);
  const start = toCell(grid, { x: minX, y: minY });
  const end = toCell(grid, { x: maxX, y: maxY });
  for (let i = start.i; i <= end.i; i++) {
    for (let j = start.j; j <= end.j; j++) {
      const center = cellCenter(grid, i, j);
      if (pointInPolygon(center, polygon)) {
        into.add(cellKey(i, j));
      }
    }
  }
}

function polygonArea(points: XY[]) {
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    sum += (points[j].x + points[i].x) * (points[j].y - points[i].y);
  }
  return sum / 2;
}

function buildBoundaryPolygon(grid: Grid, occupied: Set<string>): XY[] | null {
  if (occupied.size === 0) return null;

  // Build directed boundary edges around occupied cells (CCW).
  const nextMap = new Map<string, string[]>();
  const addEdge = (sx: number, sy: number, ex: number, ey: number) => {
    const s = `${sx.toFixed(3)},${sy.toFixed(3)}`;
    const e = `${ex.toFixed(3)},${ey.toFixed(3)}`;
    const list = nextMap.get(s);
    if (list) list.push(e);
    else nextMap.set(s, [e]);
  };

  const has = (i: number, j: number) => occupied.has(cellKey(i, j));

  occupied.forEach((key) => {
    const [iStr, jStr] = key.split(",");
    const i = Number(iStr);
    const j = Number(jStr);
    const { x0, y0, x1, y1 } = cellCorners(grid, i, j);

    // north
    if (!has(i, j + 1)) addEdge(x0, y1, x1, y1);
    // east
    if (!has(i + 1, j)) addEdge(x1, y1, x1, y0);
    // south
    if (!has(i, j - 1)) addEdge(x1, y0, x0, y0);
    // west
    if (!has(i - 1, j)) addEdge(x0, y0, x0, y1);
  });

  const loops: XY[][] = [];
  while (nextMap.size > 0) {
    const startKey = nextMap.keys().next().value as string;
    let currentKey = startKey;
    const loop: XY[] = [];

    for (let guard = 0; guard < 200000; guard++) {
      const [sx, sy] = currentKey.split(",").map(Number);
      loop.push({ x: sx, y: sy });

      const candidates = nextMap.get(currentKey);
      if (!candidates || candidates.length === 0) {
        nextMap.delete(currentKey);
        break;
      }
      const nextKey = candidates.pop() as string;
      if (candidates.length === 0) {
        nextMap.delete(currentKey);
      }
      currentKey = nextKey;
      if (currentKey === startKey) {
        break;
      }
    }

    if (loop.length >= 4) {
      loops.push(loop);
    }
  }

  if (loops.length === 0) return null;
  loops.sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)));
  return loops[0];
}

function isLatLngPoint(value: unknown): value is LatLngPoint {
  if (!value || typeof value !== "object") {
    return false;
  }
  const point = value as { latitude?: unknown; longitude?: unknown };
  return typeof point.latitude === "number" && typeof point.longitude === "number";
}

function parsePoint(value: unknown): LatLngPoint | null {
  if (Array.isArray(value) && value.length >= 2) {
    const maybeLng = value[0];
    const maybeLat = value[1];
    if (typeof maybeLng === "number" && typeof maybeLat === "number") {
      return { latitude: maybeLat, longitude: maybeLng };
    }
    return null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const point = value as {
    latitude?: unknown;
    longitude?: unknown;
    lat?: unknown;
    lng?: unknown;
    _latitude?: unknown;
    _longitude?: unknown;
  };

  if (typeof point.latitude === "number" && typeof point.longitude === "number") {
    return { latitude: point.latitude, longitude: point.longitude };
  }
  if (typeof point.lat === "number" && typeof point.lng === "number") {
    return { latitude: point.lat, longitude: point.lng };
  }
  if (typeof point._latitude === "number" && typeof point._longitude === "number") {
    return { latitude: point._latitude, longitude: point._longitude };
  }
  return null;
}

function normalizeStoredCoordinates(raw: unknown): LatLngPoint[] | null {
  let candidates: unknown[] = [];

  if (Array.isArray(raw)) {
    candidates = raw;
  } else if (raw && typeof raw === "object") {
    // Backward compatibility: some old docs stored coordinates as a map with numeric keys.
    candidates = Object.values(raw as Record<string, unknown>);
  } else {
    return null;
  }

  const coords = candidates
    .map((item) => parsePoint(item))
    .filter((item): item is LatLngPoint => !!item && isLatLngPoint(item));
  return coords.length >= 3 ? coords : null;
}

export async function fetchTerritory(userId: string): Promise<TerritoryState | null> {
  const territoryRef = doc(db, "territories", userId);
  const snapshot = await getDoc(territoryRef);
  if (!snapshot.exists()) {
    return null;
  }
  const data = snapshot.data();
  if (!data?.coordinates) {
    return null;
  }
  const polygon = normalizeStoredCoordinates(data.coordinates);
  if (!polygon || polygon.length === 0) {
    return null;
  }
  const rawUpdatedAt = data.updatedAt;
  const updatedAtMs =
    rawUpdatedAt && typeof rawUpdatedAt.toMillis === "function"
      ? (rawUpdatedAt.toMillis() as number)
      : typeof rawUpdatedAt === "number"
        ? rawUpdatedAt
        : undefined;

  return {
    userId,
    username: typeof data.username === "string" ? data.username : undefined,
    coordinates: polygon,
    areaM2: typeof data.areaM2 === "number" ? data.areaM2 : 0,
    updatedAt: updatedAtMs,
  };
}

export async function fetchAllTerritories(): Promise<TerritoryState[]> {
  const snapshot = await getDocs(collection(db, "territories"));
  return parseTerritoriesSnapshot(snapshot);
}

function parseTerritoriesSnapshot(snapshot: { forEach: (cb: (docSnap: any) => void) => void }): TerritoryState[] {
  const territories: TerritoryState[] = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const polygon = normalizeStoredCoordinates(data?.coordinates);
    if (!polygon || polygon.length === 0) {
      return;
    }
    const rawUpdatedAt = data?.updatedAt;
    const updatedAtMs =
      rawUpdatedAt && typeof rawUpdatedAt.toMillis === "function"
        ? (rawUpdatedAt.toMillis() as number)
        : typeof rawUpdatedAt === "number"
          ? rawUpdatedAt
          : undefined;

    territories.push({
      userId: typeof data?.userId === "string" ? data.userId : docSnap.id,
      username: typeof data?.username === "string" ? data.username : undefined,
      coordinates: polygon,
      areaM2: typeof data?.areaM2 === "number" ? data.areaM2 : 0,
      updatedAt: updatedAtMs,
    });
  });

  return territories;
}

export function subscribeAllTerritories(
  onData: (territories: TerritoryState[]) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    collection(db, "territories"),
    (snapshot) => {
      onData(parseTerritoriesSnapshot(snapshot));
    },
    (error) => {
      if (onError) {
        onError(error as Error);
      }
    }
  );
}

/**
 * Batch-fetch usernames from the `users` collection for a list of user IDs.
 * Returns a Map<userId, displayName>.
 */
export async function fetchUsernamesForUserIds(userIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const unique = [...new Set(userIds)].filter(Boolean);
  if (unique.length === 0) return result;

  // Firestore `in` queries support max 10 IDs at a time.
  for (let i = 0; i < unique.length; i += 10) {
    const batch = unique.slice(i, i + 10);
    try {
      const q = query(collection(db, "users"), where(documentId(), "in", batch));
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const name =
          typeof data?.username === "string" && data.username.trim().length > 0
            ? data.username
            : `Runner ${docSnap.id.slice(0, 6)}`;
        result.set(docSnap.id, name);
      });
    } catch {
      // Non-critical – labels just won't appear for this batch.
    }
  }

  // Fill in fallback for any IDs that weren't found.
  for (const id of unique) {
    if (!result.has(id)) {
      result.set(id, `Runner ${id.slice(0, 6)}`);
    }
  }
  return result;
}

export async function updateTerritoryForRun(userId: string, points: TrackPoint[]): Promise<TerritoryState | null> {
  if (points.length < 2) {
    return null;
  }

  const routePoints = points.map((point) => ({
    latitude: point.latitude,
    longitude: point.longitude,
  }));

  const territoryRef = doc(db, "territories", userId);
  const existing = await getDoc(territoryRef);
  const existingPolygonLatLng = existing.exists() ? normalizeStoredCoordinates(existing.data()?.coordinates) : null;

  // Build a local meter grid and union existing territory with a buffered polyline around the route.
  const origin = (() => {
    // Using the first point keeps numeric stability; everything is local-meter space.
    const first = routePoints[0];
    return { latitude: first.latitude, longitude: first.longitude };
  })();

  const routeXY = routePoints.map((p) => projectToXY(origin, p));
  const existingXY = existingPolygonLatLng ? existingPolygonLatLng.map((p) => projectToXY(origin, p)) : null;

  const allForBounds = existingXY ? routeXY.concat(existingXY) : routeXY;
  const bounds = computeXYBounds(allForBounds);
  const pad = DEFAULT_BUFFER_METERS + DEFAULT_CELL_SIZE_METERS * 2;

  const grid: Grid = {
    cell: DEFAULT_CELL_SIZE_METERS,
    originX: Math.floor((bounds.minX - pad) / DEFAULT_CELL_SIZE_METERS) * DEFAULT_CELL_SIZE_METERS,
    originY: Math.floor((bounds.minY - pad) / DEFAULT_CELL_SIZE_METERS) * DEFAULT_CELL_SIZE_METERS,
  };

  const occupied = rasterizeBufferedRoute(grid, routeXY, DEFAULT_BUFFER_METERS);
  if (existingXY && existingXY.length >= 3) {
    rasterizePolygon(grid, existingXY, occupied);
  }

  const boundary = buildBoundaryPolygon(grid, occupied);
  if (!boundary) {
    return null;
  }

  const cleaned = downsample(removeCollinear(boundary), MAX_POLYGON_POINTS);
  const polygon = cleaned.map((p) => unprojectToLatLng(origin, p));
  const areaM2 = occupied.size * (grid.cell * grid.cell);
  const version = existing.exists() ? (existing.data()?.version ?? 0) + 1 : 1;

  // Fetch username from users doc to embed in the territory for map labelling.
  let username: string | undefined;
  try {
    const userSnap = await getDoc(doc(db, "users", userId));
    if (userSnap.exists()) {
      const ud = userSnap.data();
      username = typeof ud?.username === "string" && ud.username.trim().length > 0
        ? ud.username
        : undefined;
    }
  } catch {
    // Non-critical – territory still works without the label.
  }

  await setDoc(
    territoryRef,
    {
      userId,
      ...(username ? { username } : {}),
      coordinates: polygon,
      areaM2,
      updatedAt: serverTimestamp(),
      version,
    },
    { merge: true }
  );

  const userRef = doc(db, "users", userId);
  try {
    await updateDoc(userRef, {
      totalArea: areaM2,
      updatedAt: serverTimestamp(),
    });
  } catch {
    await setDoc(
      userRef,
      {
        totalArea: areaM2,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  return { coordinates: polygon, areaM2 };
}

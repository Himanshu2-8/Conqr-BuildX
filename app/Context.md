# Conqr App Context (Hackathon Build)

## 1) Product Snapshot
- App name: `Conqr`
- Platform: React Native with Expo
- Core idea: users run in the real world, routes are converted into claimed territory, and players compete on leaderboard metrics.
- Current state: Firebase email/password signup + signin is implemented.

## 2) Current Tech Stack (Confirmed)
- Mobile: React Native `0.81.5`
- Runtime: Expo SDK `54`
- Language: TypeScript
- Navigation: `@react-navigation/native`, `@react-navigation/native-stack`
- Auth + DB: Firebase Auth + Firestore (`firebase` `12.x`)
- Existing profile model: `users/{uid}` with `username`, `totalDistance`, `totalArea`, `streak`.
- Legacy dependency present but not active in current auth flow: Supabase client file exists in `lib/supabase.ts`.

## 3) Target Stack for Next Milestones
- Location capture: `expo-location`
- Map rendering:
  - Option A (fastest for Expo MVP): `react-native-maps`
  - Option B (richer styling/territory visuals): Mapbox (`@rnmapbox/maps`) if native setup time is acceptable.
- Geometry ops for territory:
  - Simple local approach: custom buffered polyline approximation
  - Better approach: Turf (`@turf/turf`) in backend or Cloud Function
- Backend model: Firestore collections/subcollections (NoSQL), with optional Cloud Functions for aggregation/leaderboard materialization.

## 4) App Architecture (Proposed)
- `Auth layer`
  - Firebase auth state from `AuthContext`.
  - Ensure `users/{uid}` doc exists on signup/signin.
- `Run layer`
  - Run session state machine: `idle -> running -> stopped -> saved`.
  - GPS sampler every N seconds while running.
  - Live stats calculator: elapsed time, distance, pace.
- `Data layer`
  - `sessions` collection for run summary.
  - `gps_points` subcollection (or top-level) for route points.
  - `territories` collection for user claimed zone geometry.
  - Aggregated metrics on `users` doc for profile + leaderboard.
- `UI layer`
  - Map screen (live track + territory overlays)
  - Leaderboard screen
  - Profile screen

## 5) Feature Build Order (Exact Hackathon Sequence)
Build in this exact order:

1. Run Tracking Core
2. Session Save
3. Map Screen
4. Territory MVP
5. Leaderboard
6. Profile Screen
7. Polish for Demo

## 6) Detailed Milestone Plan

### 6.1 Run Tracking Core
- Start Run button:
  - Creates in-memory draft session with `startTime`.
  - Requests location permissions (`foreground` first).
- Stop Run button:
  - Stops GPS watcher/timer.
  - Finalizes duration, distance, avg pace.
- Live metrics:
  - Timer: `now - startTime`.
  - Distance: sum of haversine distance between valid consecutive points.
  - Pace: `duration / distance` (min/km).
- GPS capture:
  - Sample every `3-5` seconds OR distance interval (`5-10m`) depending on battery and accuracy.
  - Keep `lat`, `lng`, `timestamp`, `accuracy`, `speed`.
- Basic validity checks (pre-save):
  - Minimum duration (example: `>= 60 sec`)
  - Minimum distance (example: `>= 100 m`)
  - Reject obvious GPS jumps (example: implied speed > `8 m/s` for sustained periods if running-only app)

### 6.2 Session Save
- On stop:
  - Create `sessions/{sessionId}` summary document.
  - Write GPS points to `sessions/{sessionId}/gps_points/{pointId}` in batch/chunks.
- Save fields:
  - `userId`, `startedAt`, `endedAt`, `durationSec`, `distanceM`, `avgPaceSecPerKm`, `isValid`.
- If invalid:
  - Save anyway with `isValid=false` and `invalidReason` for debugging.

### 6.3 Map Screen
- Show user live location during run.
- Draw current run polyline in real time.
- After finish:
  - Keep final route visible.
  - Load past route from saved `gps_points`.

### 6.4 Territory MVP
- Convert path to claimed zone:
  - Buffer each line segment by a fixed radius (example `20-40m`).
  - Union with user’s existing territory polygon(s).
- Persist territory:
  - Save geometry as GeoJSON-like object in Firestore.
  - Also save cheap summary (`areaM2`, `updatedAt`) for quick leaderboard/profile reads.
- Show territory overlay on map:
  - Current user territory first.
  - Optional: lightweight display of other players later.

### 6.5 Leaderboard
- Rank key:
  - Primary mode: total area.
  - Secondary mode: total distance.
- Time toggles:
  - Daily and weekly.
  - For MVP: compute from `sessions` filtered by date range and `isValid=true`.
- Performance:
  - Hackathon-fast: query top N users from precomputed fields.
  - Better: Cloud Function updates daily/weekly aggregates.

### 6.6 Profile Screen
- Show:
  - Username
  - Total distance
  - Total area
  - Streak
- Streak logic (simple):
  - Count consecutive days with at least one valid session.
  - Update on session save.

### 6.7 Polish for Demo
- UI states:
  - Loading, empty, error for all major screens.
- Feedback moments:
  - Run complete animation.
  - Territory gained animation (value-up + map highlight).
- Demo script:
  - signup -> run -> claim -> leaderboard

## 7) Firestore Data Model ("Tables" in NoSQL Form)

### 7.1 `users` collection
- Document id: `uid`
- Purpose: profile + aggregates
- Fields:
  - `uid: string`
  - `email: string`
  - `username: string`
  - `avatarUrl: string`
  - `city: string`
  - `totalDistanceM: number`
  - `totalAreaM2: number`
  - `streakDays: number`
  - `lastRunDate: string` (YYYY-MM-DD)
  - `createdAt: timestamp`
  - `updatedAt: timestamp`

### 7.2 `sessions` collection
- Document id: generated `sessionId`
- Purpose: one run summary
- Fields:
  - `sessionId: string`
  - `userId: string`
  - `startedAt: timestamp`
  - `endedAt: timestamp`
  - `durationSec: number`
  - `distanceM: number`
  - `avgPaceSecPerKm: number | null`
  - `pointCount: number`
  - `isValid: boolean`
  - `invalidReason: string | null`
  - `claimedAreaDeltaM2: number`
  - `createdAt: timestamp`

### 7.3 `sessions/{sessionId}/gps_points` subcollection
- Document id: generated `pointId` or monotonic index
- Purpose: route geometry points
- Fields:
  - `idx: number`
  - `lat: number`
  - `lng: number`
  - `accuracyM: number | null`
  - `speedMps: number | null`
  - `capturedAt: timestamp`

### 7.4 `territories` collection
- Document id: `uid` (one per user for MVP)
- Purpose: merged claimed geometry
- Fields:
  - `userId: string`
  - `geometry: object` (GeoJSON Polygon/MultiPolygon)
  - `areaM2: number`
  - `updatedAt: timestamp`
  - `version: number`

### 7.5 `leaderboards` collection (optional optimization)
- Document id examples:
  - `daily_YYYY-MM-DD`
  - `weekly_YYYY-WW`
- Purpose: precomputed rankings to reduce heavy client queries
- Fields:
  - `periodType: "daily" | "weekly"`
  - `periodKey: string`
  - `metric: "area" | "distance"`
  - `rows: array<{ userId, username, value }>`
  - `updatedAt: timestamp`

## 8) Firestore Query/Index Notes
- Needed query patterns:
  - sessions by `userId + startedAt desc`
  - sessions by date range + `isValid`
  - leaderboard reads by aggregate docs
- Composite index examples:
  - `sessions(userId ASC, startedAt DESC)`
  - `sessions(isValid ASC, startedAt DESC)`
  - `sessions(userId ASC, isValid ASC, startedAt DESC)` (if used)

## 9) Security Rules (MVP Intent)
- Users can read/write their own `users/{uid}` profile.
- Users can create/read their own `sessions`.
- Users can write `gps_points` only under their own session.
- Territory write allowed only to owner uid doc.
- Leaderboard docs read-only for clients; write from admin/Cloud Function.

## 10) Data Integrity and Validation Rules
- Session validity:
  - Reject or flag if too short, too small distance, or suspicious GPS jumps.
- Distance calculation:
  - Ignore points with very poor accuracy (example > `50m`).
  - Clamp single-segment max distance to avoid teleports.
- Duplicate protection:
  - Use client-generated `sessionId` and idempotent writes.
  - If save retried, overwrite same `sessionId` instead of creating duplicates.

## 11) Screens and Navigation Target
- Auth stack:
  - Login
  - Signup
- App stack (next):
  - Run/Home
  - Map
  - Leaderboard
  - Profile
  - Session Detail (optional for demo polish)

## 12) Suggested Folder Expansion
- `features/run/`:
  - `useRunTracker.ts`
  - `runMetrics.ts`
  - `runValidation.ts`
- `features/map/`:
  - `MapScreen.tsx`
  - `polyline.ts`
- `features/territory/`:
  - `territoryGeometry.ts`
  - `territoryService.ts`
- `features/leaderboard/`:
  - `leaderboardService.ts`
  - `LeaderboardScreen.tsx`
- `features/profile/`:
  - `ProfileScreen.tsx`
- `services/`:
  - `sessionsService.ts`
  - `usersService.ts`
  - `firestoreConverters.ts`

## 13) Concrete MVP Acceptance Criteria
- User can signup/login with Firebase email.
- User can start and stop a run.
- Live timer, distance, and pace update while running.
- On stop, session and GPS points are saved to Firestore.
- Validity flag is computed and stored.
- Map displays live route and past saved route.
- Run path produces territory gain and merged overlay.
- Leaderboard toggles daily/weekly and shows ranking.
- Profile shows username + total distance + total area + streak.
- Demo flow works end-to-end without manual data patching.

## 14) Hackathon Scope Guardrails
- Keep territory geometry simple first (approximate buffer is acceptable).
- Prefer reliability and demo flow over perfect GIS precision.
- Precompute aggregates to avoid slow, complex queries on stage.
- Build one excellent happy-path first, then add edge-case handling.

## 15) Immediate Next Tasks
1. Add `expo-location` and map dependency (`react-native-maps` for speed).
2. Implement `useRunTracker` with GPS watcher + live metrics.
3. Add Firestore write path for `sessions` and `gps_points`.
4. Render live polyline map.
5. Add territory generation and merge.
6. Add leaderboard + profile aggregate reads.

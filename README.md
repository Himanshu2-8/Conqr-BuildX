# CONQR

CONQR is a gamified fitness and territory-claiming mobile app. Users track real-world runs, turn their routes into claimed map territory, and compete through leaderboards, quests, friends, and challenges.

The app is built with React Native, Expo, TypeScript, Firebase, Firestore, Expo Location, and React Native Maps.

## Features

- Firebase email/password signup and login
- User profile creation and profile updates
- GPS-based run tracking with distance, pace, and duration metrics
- Firestore storage for run sessions and GPS route points
- Territory claiming from completed running routes
- Interactive map with territory polygons and live location
- Fog-of-war style map exploration
- Daily and weekly leaderboards
- Quests, badges, streaks, and progress summaries
- Friends system with username-based friend search
- Friend challenges and prediction-based run challenges

## Tech Stack

- React Native
- Expo
- TypeScript
- Firebase Authentication
- Cloud Firestore
- Expo Location
- React Native Maps
- React Navigation
- AsyncStorage
- Expo Vector Icons
- Expo Linear Gradient
- React Native SVG

## Project Structure

```text
Conqr-BuildX/
├── app/
│   ├── auth/              # Login and signup screens
│   ├── components/        # Shared feature components
│   ├── context/           # Authentication context
│   ├── lib/               # Firebase and external client setup
│   ├── services/          # Firestore services and app logic
│   ├── ui/                # Reusable UI elements
│   ├── App.tsx            # App root and navigation shell
│   ├── HomeScreen.tsx     # Main dashboard and map preview
│   ├── MapPop.tsx         # Full-screen map experience
│   ├── Leaderboard.tsx    # Rankings screen
│   ├── Profile.tsx        # User profile screen
│   ├── Quests.tsx         # Quests and badges screen
│   └── Friends.tsx        # Friends and challenges screen
├── firestore.rules        # Firestore security rules
└── README.md
```

## Getting Started

### Prerequisites

- Node.js
- npm
- Expo CLI or Expo Go
- Android Studio or Xcode, depending on your target platform
- Firebase project with Authentication and Firestore enabled

### Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd Conqr-BuildX/app
npm install
```

Start the Expo development server:

```bash
npm start
```

Run on Android:

```bash
npm run android
```

Run on iOS:

```bash
npm run ios
```

Run on web:

```bash
npm run web
```

## Firebase Setup

Create a Firebase project and enable:

- Firebase Authentication
- Cloud Firestore

Add your Firebase configuration in the app's Firebase setup file under `app/lib/`.

The app uses Firestore for users, run sessions, GPS points, territories, friends, predictions, challenges, and leaderboard data.

## Firestore Collections

### users

Stores user profile and aggregate stats.

```text
users/{uid}
```

Example fields:

```json
{
  "uid": "user_id",
  "email": "runner@example.com",
  "username": "runner01",
  "city": "Mumbai",
  "collegeName": "ABC College",
  "totalDistanceM": 12000,
  "totalAreaM2": 450000,
  "streakDays": 4
}
```

### sessions

Stores completed run summaries.

```text
sessions/{sessionId}
```

Example fields:

```json
{
  "userId": "user_id",
  "startedAt": "timestamp",
  "endedAt": "timestamp",
  "durationSec": 1800,
  "distanceM": 5000,
  "avgPaceSecPerKm": 360,
  "claimedAreaDeltaM2": 25000,
  "isValid": true
}
```

### gps_points

Stores route points under each run session.

```text
sessions/{sessionId}/gps_points/{pointId}
```

Example fields:

```json
{
  "idx": 0,
  "lat": 19.076,
  "lng": 72.8777,
  "accuracyM": 12,
  "speedMps": 2.8,
  "capturedAt": "timestamp"
}
```

### territories

Stores claimed territory geometry and area per user.

```text
territories/{uid}
```

Example fields:

```json
{
  "userId": "user_id",
  "coordinates": [],
  "areaM2": 450000,
  "updatedAt": "timestamp"
}
```

## Core Flow

1. User signs up or logs in with Firebase Authentication.
2. User starts a run and grants location permission.
3. The app captures GPS points and calculates live run metrics.
4. User stops the run.
5. Run summary and GPS points are saved to Firestore.
6. The route is converted into claimed territory.
7. Profile stats, quests, predictions, and leaderboards are updated.
8. Claimed territory appears on the interactive map.

## Available Scripts

```bash
npm start
```

Starts the Expo development server.

```bash
npm run android
```

Starts the app on Android.

```bash
npm run ios
```

Starts the app on iOS.

```bash
npm run web
```

Starts the app for web.

## Future Enhancements

- More accurate territory generation using GIS libraries
- Cloud Functions for leaderboard aggregation
- Push notifications for friend challenges
- Improved GPS anti-cheat validation
- Real-time multiplayer territory battles
- Social sharing for completed runs
- Reward system for streaks and milestones

## Description

CONQR turns running into a competitive map-based game. It combines fitness tracking, territory conquest, social challenges, and Firebase-backed persistence to create a more engaging way to stay active.

## License

This project is for educational and hackathon purposes.

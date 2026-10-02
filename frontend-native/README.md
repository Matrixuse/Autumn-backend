# Autumn Native

Android-first Expo development build for the Autumn music app. The project is JavaScript, uses NativeWind and React Navigation, and follows the mobile web theme documented in [FEATURES.md](FEATURES.md).

## Local Setup

```powershell
Copy-Item .env.example .env
npm install
npx expo run:android
```

`EXPO_PUBLIC_API_URL` must point to the backend origin. The client adds `/api` unless the value already ends in `/api`. Google login is shown when `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is set; Android OAuth credentials must also include the development app's package/signing certificate configuration.

The backend returns the signed-in user as JSON and sets an HttpOnly `jiosaavn_session` cookie. The app caches the user profile in SecureStore and validates the server session with `GET /auth/profile` on startup; it does not store a bearer token because the backend does not return one.

## Android Build Prerequisites

- Android Studio with Android SDK Platform 36, build tools, NDK and an Android emulator/device.
- Java 17.
- USB debugging enabled for a physical device, or an installed emulator system image and AVD.

`npx expo run:android` runs prebuild, compiles, installs and launches on a connected device. `npm run prebuild` regenerates the ignored native `android/` directory from Expo config.

## Phase 1 Scope

The foundation includes environment-based API setup, normalized Axios errors, auth/profile restore/logout, login/register/Google login, secure cached profile state, dark theme tokens, bundled DM Sans/Space Grotesk fonts, splash/adaptive icon config and the five mobile tabs. Browse and player screens are intentionally placeholders until their phases.
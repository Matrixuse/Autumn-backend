# Saavan Player

A music player frontend backed by a JioSaavn API service.

## Project Structure

- `frontend/` - React and Vite web application
- `frontend-native/` - Expo and React Native mobile application
- `jiosaavn-api-backend/` - Bun, Hono, and TypeScript API server

## Local Setup

### Frontend

```sh
cd frontend
npm install
copy .env.example .env
npm run dev
```

Set `VITE_API_BASE_URL` in `frontend/.env` when the API is not available at the frontend's `/api` path. `VITE_GOOGLE_CLIENT_ID` is a browser-visible OAuth client ID; never place a private client secret in a `VITE_*` variable.

### Backend

```sh
cd jiosaavn-api-backend
bun install
copy .env.example .env
bun run dev
```

Set the MongoDB values in `jiosaavn-api-backend/.env` before starting the backend. The real `.env` files are intentionally ignored by Git.

## Checks

```sh
cd frontend
npm run build

cd ../jiosaavn-api-backend
bun run lint
bun run test
```

This project uses the unofficial JioSaavn API service and is not affiliated with JioSaavn.

# GHGIMobile — React Native App

Expo Router app for the GHG Inventory system.

## Setup

```bash
cd GHGIMobile
npm install
npx expo start
```

## Backend

Requires the Laravel server running at `http://127.0.0.1:8000`.

```bash
cd ../GHGI
php artisan serve
```

Make sure Sanctum is configured. The app uses token auth via `/api/mobile/*` routes.

## Structure

```
app/
  _layout.tsx          — root layout, auth guard
  (auth)/login.tsx     — login screen
  (tabs)/
    index.tsx          — dashboard
    forms.tsx          — sector/form list
    submissions.tsx    — submission history
    sync.tsx           — offline sync manager
    profile.tsx        — user profile + logout
  form/[type].tsx      — data entry form (all 12 form types)
  submission/[id].tsx  — submission detail view
lib/
  api.ts               — axios client (Sanctum token)
  db.ts                — SQLite offline draft storage
  store.ts             — Zustand auth state
  sync.ts              — offline → server sync logic
```

## Offline Mode

Drafts are saved to local SQLite when offline. Go to the Sync tab to upload pending drafts when back online.

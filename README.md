# Chimney Pro

Mobile job ticket tracker for a chimney service business: paste a ticket, add
line items and costs, track parts cost, scheduled date, whether a repair team
is needed, and deposit amount/method. Includes an Insights dashboard, a gas
expense log, and tech profit / cash-owed tracking.

## Stack

- React + TypeScript (Vite), deployed as a static site
- All data (jobs, gas log) is stored in the browser's `localStorage` — there
  is no backend. Data lives on whichever device/browser you use the app in.

## Run locally

```bash
npm run install:all   # first time only
npm run dev
```

Open http://localhost:5173.

## Deploy

Pushing to `main` builds the app and deploys it to GitHub Pages via
`.github/workflows/deploy.yml`. The Vite `base` in `client/vite.config.ts`
and the GitHub Pages source (Settings → Pages → Source: GitHub Actions) need
to match the repo name.

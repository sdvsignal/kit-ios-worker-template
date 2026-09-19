# kit-ios-worker-template

Cloudflare Worker backend for an iOS app. TypeScript, Workers + D1 + KV.

## Commands
- Install: `npm install`
- Dev: `npm run dev` (applies D1 migrations locally, then `wrangler dev`)
- Test: `npm test` (unit) and `npm run test:e2e` (Playwright against `wrangler dev`)
- Lint / type check: `npm run check` (tsc + `wrangler deploy --dry-run`)

## Layout
- `src/index.ts`: routes, rate limit, failure events, StoreKit mount
- `src/lib.ts`: pure helpers (unit-tested without the Workers runtime)
- `migrations/`: D1 schema (StoreKit tables from storekit-cloudflare-workers + failure_events)
- `client/KitBackend.swift`: the iOS side of the failure-event route

## Rules
- Every 4xx/5xx is JSON with `error` and `request_id`. Keep it that way.
- Don't reimplement Apple JWS verification or entitlement logic; it comes from storekit-cloudflare-workers.
- Replace the `authenticate` stub (X-Device-Id header) with your real session before shipping.
- Run `/kit-ship-check:run` before any commit.

## Never
- Never commit `.dev.vars`, `.p8` files or any Apple key.
- Never prove a 429 with a burst loop; seed the KV key (see tests/e2e).

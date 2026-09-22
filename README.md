# kit-ios-worker-template

**Every indie iOS subscription app rebuilds the same backend: verify the receipt, catch the webhook,
see the failures, stop the abuse.** This is that backend, as a Cloudflare Worker you can deploy in
one click — StoreKit 2 transaction verification, App Store Server Notifications V2, failure events
in D1, and a rate limit.

If you searched for a StoreKit 2 Cloudflare Worker template, an App Store Server Notifications V2 webhook, or a
receipt verification backend for an iOS subscription app, that is what this is.

<!-- dash-content-start -->

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sdvsignal/kit-ios-worker-template)

| Route | What it does |
|---|---|
| `GET /health` | JSON with version and environment name |
| `POST /v1/events/failure` | Logs `{app, event, error_type, context?}` to D1. A missing or empty field returns 400 naming the field |
| `POST /v1/storekit/transactions/sync` | Verifies an Apple-signed StoreKit 2 transaction and stores the entitlement |
| `GET /v1/storekit/entitlement` | Reads the caller's current entitlement |
| `POST /v1/storekit/notifications` | App Store Server Notifications V2 webhook (idempotent, out-of-order safe) |

- **Rate limit:** a per-device (else per-IP) KV counter, `RATE_LIMIT_PER_MIN` per minute, 429 with `Retry-After`. Apple's webhook is exempt.
- **Every error is JSON** with `error` and `request_id`. A handler exception also writes a `failure_events` row, so problems are visible the same day.
- **StoreKit** comes from [storekit-cloudflare-workers](https://github.com/burakdede/storekit-cloudflare-workers) (MIT): JWS and certificate-chain verification, grace periods, refunds, family sharing, upgrades. This template mounts it; it doesn't reimplement it.

<!-- dash-content-end -->

## Want your repo set up for Claude Code first?

The template is MIT and complete. If you want a CLAUDE.md, a tool allowlist and one skill wired for
*your* repo before you start on the Worker:

**[Buy Setup Lite — $29](https://buy.stripe.com/3cI14pcsf6DA8Xw4B3f3a0a?client_reference_id=from-gh-ios-worker)** · ~24h, handed back as a PR.

Details: [kit.sdvsignal.com/#setup-lite](https://kit.sdvsignal.com/#setup-lite) · wiring this Worker
into your app is a [Build Packet $399](https://kit.sdvsignal.com/#build-packet).

## 60-second start

Click **Deploy to Cloudflare** above. It forks the repo, creates the D1 database, applies the
migrations and deploys. Then:

```bash
curl https://your-worker.workers.dev/health
```

You should get JSON with a version and an environment name. That is a live backend, before you have
touched a secret — the StoreKit routes reject requests until you add Apple's keys, and everything
else already works.

Locally instead:

```bash
npm install && npm run dev     # local D1 migrations + wrangler dev
npm test                       # unit tests, no network
```

## What to change first

1. **`authenticate` in `src/index.ts`.** The template trusts an `X-Device-Id` header so it runs out of the box. **Replace it with your real session before you ship.**
2. **Vars in `wrangler.jsonc`:** `STOREKIT_BUNDLE_ID`, `STOREKIT_ALLOWED_PRODUCT_IDS`, `STOREKIT_ALLOWED_ENVIRONMENTS` (add `Production` and `APP_STORE_APP_APPLE_ID` when you go live).
3. **Secrets** (names in `.dev.vars.example`): `npx wrangler secret put APP_STORE_CONNECT_ISSUER_ID`, and the same for `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_PRIVATE_KEY` and `APPLE_ROOT_CERTIFICATES_PEM`. Until they're set, the StoreKit routes reject requests and the other routes work.
4. **D1 migrations:** `npm run deploy` applies them remotely, then deploys.

## iOS side

`client/KitBackend.swift` (20 lines) reports failures:

```swift
let backend = KitBackend(baseURL: URL(string: "https://your-worker.workers.dev")!, deviceID: installID)
await backend.reportFailure(app: "MyApp", event: "purchase_failed", errorType: "network_timeout")
```

For purchases, post the verified transaction's `jwsRepresentation` as `signedTransactionJWS` to `/v1/storekit/transactions/sync`; see the library's [iOS client guide](https://github.com/burakdede/storekit-cloudflare-workers/blob/main/docs/ios-client.md).

## Why failure events are a route and not a nice-to-have

`POST /v1/events/failure` exists because a network call that can fail silently *will* fail silently,
and you will find out from a review instead of from your own data. Every external call in the client
should fire one of these on its failure path. It is the cheapest thing in this repo and the one that
pays for itself first.

## Develop

```
npm install
npm run dev          # local D1 migrations + wrangler dev
npm test             # unit tests
npm run test:e2e     # Playwright API tests against wrangler dev
npm run check        # tsc + wrangler deploy --dry-run
```

## Free here vs. paid

**The whole template is MIT and production-shaped.** Nothing is stubbed to push you into buying.

Paid is the wiring into *your* app: swapping the placeholder `authenticate` for your real session,
matching product IDs and entitlement logic to your paywall, and the migration plan if you already
have live subscribers. That is a **Build Packet $399** (custom MCP server or Cloudflare Worker,
≤3 routes, with tests, 5 business days) or **MCP Basic $199** (one custom MCP tool, schema and
handoff notes). Just want your repo set up for Claude Code first? **Setup Lite $29** (24h, as a PR)
or **Setup Sprint $99** (48h).

Same app needs a store listing? **ASO Launch Pack $19** is the metadata side (keyword map, subtitle
and description templates, screenshot storyboard, App Store Connect paste checklist). **Preview Pack
$149** is one App Store preview video to Apple's spec from your screen recordings, plus 5 stills and
2 revision rounds, in 72 hours.

**→ Scope and order: [kit.sdvsignal.com](https://kit.sdvsignal.com/?utm_source=github&utm_medium=organic&utm_campaign=afm-find&utm_content=gh-readme-kit-ios-worker-template)**

We use AI tools including Claude; a person reviews every deliverable before it ships.

## Credits

StoreKit handling: [storekit-cloudflare-workers](https://github.com/burakdede/storekit-cloudflare-workers) by Burak Dede, MIT. Independent project, not affiliated with Apple or Cloudflare. "StoreKit" and "App Store" are Apple trademarks; "Cloudflare", "Workers", "D1" are Cloudflare trademarks.

## License

MIT

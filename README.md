# kit-ios-worker-template

A Cloudflare Worker backend for an iOS app, deployable in one click. It gives you the three things most indie iOS backends end up rebuilding: StoreKit 2 purchase verification, failure events you can actually see, and a rate limit.

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

## What to change first

1. **`authenticate` in `src/index.ts`.** The template trusts an `X-Device-Id` header so it runs out of the box. Replace it with your real session before you ship.
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

## Develop

```
npm install
npm run dev          # local D1 migrations + wrangler dev
npm test             # unit tests
npm run test:e2e     # Playwright API tests against wrangler dev
npm run check        # tsc + wrangler deploy --dry-run
```

## Credits

StoreKit handling: [storekit-cloudflare-workers](https://github.com/burakdede/storekit-cloudflare-workers) by Burak Dede, MIT. Independent project, not affiliated with Apple or Cloudflare. "StoreKit" and "App Store" are Apple trademarks; "Cloudflare", "Workers", "D1" are Cloudflare trademarks.

---

**Want this tuned to your repo?** Fixed-price setup from Kit: **Setup Sprint $99** (48h) · **Build Packet $399** (custom MCP server or Cloudflare Worker, 5 business days). Order and scope: [kit-sdvsignal.pages.dev](https://kit-sdvsignal.pages.dev)

We use AI tools including Claude; a person reviews every deliverable before it ships.

## License

MIT

import { createStoreKitHandler, type StoreKitWorkerEnv } from "storekit-cloudflare-workers";
import { rateKey, retryAfterSeconds, validateFailureEvent } from "./lib";

export interface Env extends StoreKitWorkerEnv {
  DB: D1Database;
  RATE_KV: KVNamespace;
  ENV_NAME?: string;
  RATE_LIMIT_PER_MIN?: string;
  /** "true" only in local/e2e runs: exposes GET /v1/events/failure?limit=N. */
  ALLOW_EVENT_READ?: string;
}

const VERSION = "0.1.0";

const json = (status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

// StoreKit 2 sync / entitlement / Apple Notifications V2, from storekit-cloudflare-workers (MIT).
const storekit = createStoreKitHandler<Env>({
  // REPLACE WITH YOUR SESSION. This template trusts an X-Device-Id header so it runs out of the box;
  // a real app must resolve the caller from its own auth (see the library's "What you supply").
  authenticate: (request) => {
    const id = request.headers.get("x-device-id");
    return id && /^[A-Za-z0-9-]{8,64}$/.test(id) ? { accountId: id } : null;
  },
  database: (env) => env.DB,
  paths: {
    sync: "/v1/storekit/transactions/sync",
    entitlement: "/v1/storekit/entitlement",
    notifications: "/v1/storekit/notifications",
  },
});

async function recordFailure(env: Env, app: string, event: string, errorType: string, context: unknown) {
  await env.DB.prepare("INSERT INTO failure_events (id, app, event, error_type, context) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), app, event, errorType, context === undefined ? null : JSON.stringify(context).slice(0, 4000))
    .run();
}

/** KV per-minute counter. Returns a 429 response when over the limit, else null. */
async function rateLimit(request: Request, env: Env, requestId: string): Promise<Response | null> {
  const limit = Number(env.RATE_LIMIT_PER_MIN || "60");
  const now = Date.now();
  const key = rateKey(request.headers.get("x-device-id"), request.headers.get("cf-connecting-ip"), now);
  const count = Number((await env.RATE_KV.get(key)) || "0");
  if (count >= limit) {
    const retry = retryAfterSeconds(now);
    return json(429, { error: "rate_limited", request_id: requestId }, { "retry-after": String(retry) });
  }
  // KV is eventually consistent, so bursts can slip a few requests past the limit. Good enough to
  // stop abuse; use a Durable Object if you need an exact count.
  // Fail open on the write: the free-tier daily put() cap throws "KV put() limit exceeded for the day",
  // and a rate limiter must never 500 every request. The read above still enforces existing counts.
  try {
    await env.RATE_KV.put(key, String(count + 1), { expirationTtl: 120 });
  } catch (err) {
    console.error("KV rate-limit put failed (fail open):", (err as Error)?.message);
  }
  return null;
}

async function route(request: Request, env: Env, ctx: ExecutionContext, requestId: string): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/health" && request.method === "GET") {
    return json(200, { ok: true, version: VERSION, env: env.ENV_NAME || "unknown" });
  }
  // Apple's notification webhook is exempt: Apple retries in bursts from shared IPs and signs every call.
  const limited = url.pathname === "/v1/storekit/notifications" ? null : await rateLimit(request, env, requestId);
  if (limited) return limited;

  if (url.pathname === "/v1/events/failure") {
    if (request.method === "POST") {
      let body: unknown;
      try { body = await request.json(); } catch { return json(400, { error: "invalid_json", request_id: requestId }); }
      const v = validateFailureEvent(body);
      if ("error" in v) return json(400, { ...v, request_id: requestId });
      await recordFailure(env, v.app, v.event, v.error_type, v.context);
      return json(201, { ok: true, request_id: requestId });
    }
    if (request.method === "GET" && env.ALLOW_EVENT_READ === "true") {
      const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || "1")));
      const { results } = await env.DB.prepare(
        "SELECT app, event, error_type, context, created_at FROM failure_events ORDER BY created_at DESC LIMIT ?"
      ).bind(limit).all();
      return json(200, { events: results, request_id: requestId });
    }
  }

  const sk = await storekit.fetch(request, env, ctx);
  if (sk && sk.status >= 400) {
    // Same error shape as every other route: keep the library's code/message, add error + request_id.
    let body: Record<string, unknown> = {};
    try { body = (await sk.clone().json()) as Record<string, unknown>; } catch { /* non-JSON error body */ }
    return json(sk.status, { ...body, error: body.error ?? body.code ?? "storekit_error", request_id: requestId },
      Object.fromEntries([...sk.headers].filter(([k]) => k.toLowerCase() !== "content-type" && k.toLowerCase() !== "content-length")));
  }
  if (sk) return sk;
  return json(404, { error: "not_found", request_id: requestId });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestId = crypto.randomUUID();
    try {
      const res = await route(request, env, ctx, requestId);
      const out = new Response(res.body, res);
      out.headers.set("x-request-id", requestId);
      return out;
    } catch (err) {
      // Every handler exception is visible the same day: a row in failure_events plus a JSON 500.
      ctx.waitUntil(recordFailure(env, "worker", "handler_exception", (err as Error)?.name || "Error",
        { message: String((err as Error)?.message || err).slice(0, 500), path: new URL(request.url).pathname }).catch(() => {}));
      return json(500, { error: "internal_error", request_id: requestId });
    }
  },
} satisfies ExportedHandler<Env>;

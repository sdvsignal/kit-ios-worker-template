import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";

const dev = (id: string) => ({ "x-device-id": id, "content-type": "application/json" });

test("health is 200 JSON with version and env", async ({ request }) => {
  const r = await request.get("/health");
  expect(r.status()).toBe(200);
  expect(await r.json()).toMatchObject({ ok: true, version: "0.1.0", env: "e2e" });
});

test("failure event with an empty body is 400 naming the field, with a request_id", async ({ request }) => {
  const r = await request.post("/v1/events/failure", { headers: dev("e2e-empty-0001"), data: {} });
  expect(r.status()).toBe(400);
  const b = await r.json();
  expect(b).toMatchObject({ error: "missing_field", field: "app" });
  expect(b.request_id).toMatch(/^[0-9a-f-]{36}$/);
});

test("malformed JSON is 400 invalid_json", async ({ request }) => {
  const r = await request.post("/v1/events/failure", { headers: dev("e2e-bad-json-01"), data: "{nope" });
  expect(r.status()).toBe(400);
  expect((await r.json()).error).toBe("invalid_json");
});

test("valid failure event is 201 and the row is readable", async ({ request }) => {
  const marker = `e2e-${Date.now()}`;
  const r = await request.post("/v1/events/failure", {
    headers: dev("e2e-valid-00001"),
    data: { app: "E2E", event: marker, error_type: "timeout", context: { ms: 30000 } },
  });
  expect(r.status()).toBe(201);
  const read = await request.get("/v1/events/failure?limit=1", { headers: dev("e2e-valid-00001") });
  expect(read.status()).toBe(200);
  const { events } = await read.json();
  expect(events[0]).toMatchObject({ app: "E2E", event: marker, error_type: "timeout" });
});

test("bad JWS on the StoreKit sync route is a 4xx JSON, never a 5xx", async ({ request }) => {
  const r = await request.post("/v1/storekit/transactions/sync", {
    headers: dev("e2e-storekit-001"),
    data: { signedTransactionJWS: "not.a.jws" },
  });
  expect(r.status()).toBeGreaterThanOrEqual(400);
  expect(r.status()).toBeLessThan(500);
  expect(r.headers()["content-type"]).toContain("application/json");
  const b = await r.json();
  expect(b.error).toBe("VALIDATION_ERROR");
  expect(b.request_id).toMatch(/^[0-9a-f-]{36}$/);
});

test("StoreKit route without a caller is 401 with the shared error shape", async ({ request }) => {
  const r = await request.get("/v1/storekit/entitlement");
  expect(r.status()).toBe(401);
  expect((await r.json()).request_id).toMatch(/^[0-9a-f-]{36}$/);
});

test("unknown path is 404 JSON with a request_id", async ({ request }) => {
  const r = await request.get("/nope", { headers: dev("e2e-404-000001") });
  expect(r.status()).toBe(404);
  expect(await r.json()).toMatchObject({ error: "not_found" });
});

test("a seeded rate-limit key returns 429 with Retry-After", async ({ request }) => {
  // Seed this minute's and next minute's bucket (KV undercounts bursts, so never prove a 429 by looping).
  const id = "e2e-ratelimit-01";
  const m = Math.floor(Date.now() / 60000);
  for (const k of [m, m + 1]) execSync(`npx wrangler kv key put --local --binding RATE_KV "rl:d:${id}:${k}" 9999`, { stdio: "ignore" });
  const r = await request.post("/v1/events/failure", { headers: dev(id), data: { app: "E2E", event: "x", error_type: "y" } });
  expect(r.status()).toBe(429);
  expect(Number(r.headers()["retry-after"])).toBeGreaterThanOrEqual(1);
  expect((await r.json()).error).toBe("rate_limited");
});

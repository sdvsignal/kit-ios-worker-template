import { test } from "node:test";
import assert from "node:assert/strict";
import { rateKey, retryAfterSeconds, validateFailureEvent } from "../../src/lib.ts";

test("valid failure event passes through", () => {
  const v = validateFailureEvent({ app: "MyApp", event: "estimate_failed", error_type: "timeout", context: { ms: 30000 } });
  assert.deepEqual(v, { app: "MyApp", event: "estimate_failed", error_type: "timeout", context: { ms: 30000 } });
});
test("missing, empty and wrong-type fields name the field", () => {
  assert.deepEqual(validateFailureEvent({}), { error: "missing_field", field: "app" });
  assert.deepEqual(validateFailureEvent({ app: "A", event: "  " }), { error: "missing_field", field: "event" });
  assert.deepEqual(validateFailureEvent({ app: "A", event: "e", error_type: 5 }), { error: "missing_field", field: "error_type" });
  assert.deepEqual(validateFailureEvent({ app: "x".repeat(201), event: "e", error_type: "t" }), { error: "missing_field", field: "app" });
});
test("non-object bodies are invalid_json", () => {
  for (const b of [null, "str", 3, [1]]) assert.deepEqual(validateFailureEvent(b), { error: "invalid_json" });
});
test("rate key prefers a well-formed device id, else IP, bucketed per minute", () => {
  const t = 1_800_000_000_000;
  assert.equal(rateKey("ABCDEF12-3456", "1.2.3.4", t), `rl:d:ABCDEF12-3456:${Math.floor(t / 60000)}`);
  assert.equal(rateKey("bad id!", "1.2.3.4", t), `rl:ip:1.2.3.4:${Math.floor(t / 60000)}`);
  assert.equal(rateKey(null, null, t), `rl:ip:unknown:${Math.floor(t / 60000)}`);
  assert.notEqual(rateKey("ABCDEF12", null, t), rateKey("ABCDEF12", null, t + 60_000));
});
test("Retry-After is 1..60 seconds to the next minute", () => {
  assert.equal(retryAfterSeconds(60_000 * 5), 60);
  assert.equal(retryAfterSeconds(60_000 * 5 + 59_500), 1);
  assert.equal(retryAfterSeconds(60_000 * 5 + 30_000), 30);
});

// Pure helpers: no Worker runtime, so they unit-test under plain Node.

export type FailureEvent = { app: string; event: string; error_type: string; context?: unknown };
export type Invalid = { error: "missing_field"; field: string } | { error: "invalid_json" };

const REQUIRED = ["app", "event", "error_type"] as const;

/** Validate a failure event body. Empty or missing required fields name the field. */
export function validateFailureEvent(body: unknown): FailureEvent | Invalid {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return { error: "invalid_json" };
  const b = body as Record<string, unknown>;
  for (const f of REQUIRED) {
    if (typeof b[f] !== "string" || (b[f] as string).trim() === "" || (b[f] as string).length > 200) {
      return { error: "missing_field", field: f };
    }
  }
  return { app: b.app as string, event: b.event as string, error_type: b.error_type as string, context: b.context };
}

/** Rate-limit bucket key: one per caller per minute. Device id wins over IP. */
export function rateKey(deviceId: string | null, ip: string | null, nowMs: number): string {
  const who = (deviceId && /^[A-Za-z0-9-]{8,64}$/.test(deviceId) ? `d:${deviceId}` : `ip:${ip || "unknown"}`);
  return `rl:${who}:${Math.floor(nowMs / 60000)}`;
}

/** Seconds until the current minute bucket rolls over (the Retry-After value). */
export function retryAfterSeconds(nowMs: number): number {
  return Math.max(1, 60 - Math.floor((nowMs % 60000) / 1000));
}

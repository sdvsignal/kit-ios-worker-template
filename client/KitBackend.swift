import Foundation

/// Minimal client for the template's failure-event route. Call `reportFailure` wherever a network
/// call fails so failures show up in D1 the same day instead of never.
struct KitBackend {
    let baseURL: URL                      // your Worker, e.g. https://your-worker.your-subdomain.workers.dev
    let deviceID: String                  // stable per install; replace with your own session later

    func reportFailure(app: String, event: String, errorType: String, context: [String: String] = [:]) async {
        var req = URLRequest(url: baseURL.appending(path: "v1/events/failure"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(deviceID, forHTTPHeaderField: "X-Device-Id")
        let body: [String: Any] = ["app": app, "event": event, "error_type": errorType, "context": context]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        _ = try? await URLSession.shared.data(for: req)   // fire and forget: never block the UI on telemetry
    }
}

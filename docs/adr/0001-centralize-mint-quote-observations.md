---
status: accepted
---

# Centralize mint quote observations

The server will retain both HTTP polling and WebSocket subscriptions as independent mint-observation transports, but both will submit Quote Observations to one transport-neutral handler. That handler alone will reconcile observations with the database, atomically persist allowed Quote State Changes, and emit typed in-memory events after commit. Poll scheduling will use a local `last_polled_at` timestamp; correctness will not depend on the mint's optional `updated_at`. This design assumes a single running application instance, so events are process-local and best-effort. See [the implementation map](../mint-quote-monitoring-implementation-map.md) and [vertical-slice roadmap](../mint-quote-monitoring-roadmap.md) for the planned cutover.

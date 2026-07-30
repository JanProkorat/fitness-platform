---
description: Error handling strategy for endpoints
---

# Error Handling Rules

## Core principle

- **Expected failures** (entity not found, no permission, business rule violation, invalid state) → return via `Send.XAsync(ct)`.
- **Unexpected failures** (database down, network error, NullReferenceException) → let the exception propagate to the global exception handler.

Never use exceptions for control flow. Never return `null` to indicate failure to the caller.

## Send for expected errors

Every expected error is `Send.*Async(ct)` + `return;`. FastEndpoints maps to HTTP status codes automatically.

| Status | Send call | Use for |
|--------|-----------|---------|
| 400 | `Send.ErrorsAsync(400, ct)` | generic bad request |
| 401 | `Send.UnauthorizedAsync(ct)` | missing/invalid credentials |
| 403 | `Send.ForbidAsync(ct)` | authenticated but not authorized |
| 404 | `Send.NotFoundAsync(ct)` | entity not found |
| 409 | `Send.ErrorsAsync(409, ct)` | conflict / invalid state |

For a structured error payload (code + message), call `AddError(...)` before `Send.ErrorsAsync(ct)` — FastEndpoints serializes the failures into the response.

## Exceptions for infrastructure

Let infrastructure errors propagate (DB connection failures, network timeouts, deserialization errors, unexpected `null`, programmer bugs). The global exception handler catches them (#global-exception-handler).

Do not wrap `DbContext` / HTTP calls in `try/catch` unless (1) failure is expected and recoverable (e.g. non-critical calendar sync fails, main op succeeds) or (2) you want to log and degrade gracefully.

## No exceptions for control flow

Do not throw `KeyNotFoundException`, `InvalidOperationException` etc., or custom "domain" exceptions to signal expected errors.

```csharp
// DO
if (order is null)
{
    await Send.NotFoundAsync(ct);
    return;
}
```

## Global exception handler

Wired in `Program.cs`. Catches every unhandled exception → RFC 7807 ProblemDetails with `500 Internal Server Error`, correlation/trace ID, no stack traces in production (non-prod may include).

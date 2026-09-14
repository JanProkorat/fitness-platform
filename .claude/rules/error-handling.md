---
description: Error handling strategy for FitnessPlatform backend endpoints
---

# Error Handling Rules

> **Descriptive.** Counts below were measured against
> `backend/FitnessPlatform.Application/Features` on `develop` at `dc990021`
> (issue #937).

## Core principle

- **Expected failures** (entity not found, no permission, business rule
  violation, invalid state) → write the response from the endpoint and
  `return;`. Three mechanisms are in use — see
  #send-for-expected-errors.
- **Unexpected failures** (database down, network error,
  `NullReferenceException`) → let the exception propagate to the global
  exception handler (#global-exception-handler).

Never invent a custom domain exception to signal an expected error. Never
return `null` from an endpoint to mean "failure" — `null` from a
`Load…OrRespondAsync` helper means *"a response has already been written,
just return"* (see `rules/api-design.md#extract-guards-when-many`), which is
a different contract.

## Send for expected errors

Three shipped mechanisms. Pick by whether the client needs a machine-
readable error code.

### 1. Bare status — `Send.*Async(ct)` (715 call sites)

No error code, no body. The default for the common cases.

| Status | Call | Sites | Use for |
|---|---|---|---|
| 401 | `await Send.UnauthorizedAsync(ct);` | 217 | missing / unreadable caller claim |
| 403 | `await Send.ForbiddenAsync(ct);` | 22 | authenticated but not authorized |
| 404 | `await Send.NotFoundAsync(ct);` | 222 | entity missing, **or** deliberately indistinguishable from not-readable |
| 200 | `await Send.OkAsync(response, ct);` | 191 | success |
| 204 | `await Send.NoContentAsync(ct);` | 49 | success, no body |
| 201 | `await Send.CreatedAtAsync<TEndpoint>(routeValues, response, cancellation: ct);` | 9 | creation |

It is `Send.ForbiddenAsync`, **not** `Send.ForbidAsync`.
`Send.ErrorsAsync(...)` has **0** call sites in this backend — a rule
recommending it was removed in #937; use mechanism 2 or 3 instead.

### 2. Coded ProblemDetails — `this.SendProblemAsync(...)` (110 call sites)

`Domain/Extensions/EndpointErrorExtensions.SendProblemAsync` writes an RFC
7807 body directly. Use it whenever the client must branch on *which*
failure occurred.

```csharp
await this.SendProblemAsync(404, ErrorCodes.PlanNotFound, "Training plan not found.", ct);
return;
```

It does **not** throw — always `return;` after it.

**Wire shape gotcha.** `SendProblemAsync` puts the code in a **top-level
camelCase `errorCode`** extension member. FastEndpoints' own validation
failures instead expose it at `errors[].reason`. The web client's
`getErrorCode()` reads only the latter and returns `null` for a
`SendProblemAsync` response — so if a client needs to branch on this code,
check that the client actually parses this shape.

### 3. Coded 400 — `ThrowError(...)` / `ThrowErrorWithCode(...)` (58 call sites)

FastEndpoints' own `ThrowError(message)` adds a validation failure and
throws `ValidationFailureException`, which FastEndpoints converts to a 400.
This is framework control flow, not an exception escaping to the global
handler — it is the idiomatic way to fail a request from inside
`HandleAsync` without a manual `return`.

`this.ThrowErrorWithCode(errorCode, message)`
(`Domain/Extensions/EndpointErrorExtensions`) is the same thing with a
machine-readable code attached, surfacing at `errors[].reason`.

`AddError(...)` (6 sites) accumulates several failures — typically
ASP.NET Identity results — before a `ThrowIfAnyErrors()`.

## Exceptions for infrastructure

Let infrastructure errors propagate (DB connection failures, network
timeouts, deserialization errors, unexpected `null`, programmer bugs). The
global exception handler catches them (#global-exception-handler).

Do not wrap `DbContext` / Mongo / HTTP calls in `try/catch` unless (1) the
failure is expected and recoverable (a non-critical push notification fails
while the main operation succeeds) or (2) you want to log and degrade
gracefully — and then log it.

## No exceptions for control flow

Do not throw `KeyNotFoundException`, `InvalidOperationException`, or a
custom "domain" exception to signal an expected error. There is exactly **1**
`throw new …Exception` in all of `Features/**`.

`ThrowError` / `ThrowErrorWithCode` / `ValidationFailureException` are the
exception to this rule, not a violation of it: they are FastEndpoints'
sanctioned request-failure path and never reach the global handler.

```csharp
// DO
if (order is null)
{
    await Send.NotFoundAsync(ct);
    return;
}
```

## Global exception handler

`Middleware/GlobalExceptionHandler.cs`, wired in `Program.cs`. Catches every
unhandled exception → RFC 7807 ProblemDetails with `500 Internal Server
Error` and a trace id; no stack traces in production.

FastEndpoints' own error responses are configured globally in `Program.cs`
via `c.Errors.UseProblemDetails(x => x.IndicateErrorCode = true)`.

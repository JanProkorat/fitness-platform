---
description: Naming conventions for files, types, routes, and identifiers
---

# Naming Conventions

## Files and types

One type per file. File name matches type name exactly. No nested public types.

## File naming patterns

```
GetOrderEndpoint.cs
CreateOrderEndpoint.cs
GetOrdersOverviewEndpoint.cs        // plural + context
GetCurrentUserOrdersEndpoint.cs     // context qualifier

CreateOrderRequest.cs

GetOrderResponse.cs                 // endpoint payload
OrderSummaryDto.cs                  // shared DTO reused across features

CreateOrderValidator.cs

OrdersFeatureConfiguration.cs
```

Responses are `record` — see rules/csharp-style.md#records-for-dtos.

## Error codes

`"{Domain}.{ErrorName}"` — frontend localization keys, stable across releases. Full structure: `rules/validation.md#error-codes`.

## Migrations

Descriptive, present tense `{Verb}{Target}`.

```
AddOrdersTable
RenameOrderTotalToAmount
DropLegacyTimesheetTable
```

## Test naming

`{Method}_{StateUnderTest}_{ExpectedBehavior}`.

```csharp
HandleAsync_OrderNotFound_Returns404
HandleAsync_UserHasNoPermission_Returns403
HandleAsync_ValidRequest_CreatesOrderAndReturns201
Validate_EmptyCustomerId_FailsWithCorrectCode
```

## Local variable naming

Local variables MUST have descriptive names. The following identifier shapes are **forbidden**:

- One or two-character names.
- camelCase abbreviations of unfamiliar tokens (`isWo`, `plnId`).
- Abbreviations of domain terms (`pln` for `planning`, `snap` for `snapshot`).

Allowed exceptions:

- Loop counters: e.g. `i` in `for` / `foreach (var i in Enumerable.Range(...))`.
- LINQ lambda parameters: `o` in `orders.Where(o => o.Total > 100)`.
- Caught exception: `ex` in `catch (Exception ex)`.
- Discards: `_` in tuple deconstruction, unused lambda parameters, `out _`.
- Established repo conventions: `ct` (`CancellationToken`), `req` (FastEndpoints request param), `app` (integration-test fixture), `db` (`DbContext` param, when scope is obvious).

---
description: FluentValidation rules for request DTOs
---

# Validation Rules

## Two levels

Never mix — validator = "is the input well-formed?"; endpoint = "is this operation allowed?".

1. **FluentValidation** — input shape (format, range, required). Runs before handler. Failure → 400.
2. **Endpoint logic** — domain state (entity exists, permission, business rule). Failure → `Send.XAsync(ct)` (rules/error-handling.md).

## When to add a validator

Required for endpoints with a body (POST/PUT/PATCH) or non-trivial query/route params. Not needed for no-input endpoints or pure id lookups.

## Validator class

`internal sealed`, inherits `Validator<TRequest>` (FastEndpoints — NOT `AbstractValidator<T>`). Always `.WithErrorCode(...)`.


## Error codes

`const string` in a `ErrorCodes` static class. Format `"{Domain}.{ErrorName}"`. Stable — frontend localization keys.


## Testing validators

Unit test with `.TestValidate(...)`. No FastEndpoints needed.

```csharp
var result = new CreateOrderValidator().TestValidate(new CreateOrderRequest { CustomerId = Guid.Empty, Total = 10 });
result.ShouldHaveValidationErrorFor(x => x.CustomerId).WithErrorCode(ErrorCodes.Validation.CustomerIdRequired);
```

## What goes where

| Validation type | Where |
|-----------------|-------|
| Required, format, range, enum | Validator |
| Entity exists | Endpoint → `Send.NotFoundAsync(ct)` |
| Caller permission | Endpoint → `Send.ForbidAsync(ct)` |
| Business state / state machine | Endpoint → `Send.XAsync(ct)` |
| Cross-entity invariants | Endpoint → `Send.XAsync(ct)` |

## No magic strings

1. Introduce an `enum` (or `readonly record struct`) on the domain side.
2. Type the request property as that enum, so FastEndpoints' binder converts at the edge.
3. Validate range / membership against the enum (`IsInEnum()`, `NotEqual(Undefined)`).


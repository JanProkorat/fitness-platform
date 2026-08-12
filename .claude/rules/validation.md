---
description: FluentValidation rules for request DTOs in the FitnessPlatform backend
---

# Validation Rules

> **Descriptive.** Counts below were measured against
> `backend/FitnessPlatform.Application` on `develop` at `dc990021` (issue
> #937).

## Two levels

Never mix — validator = "is the input well-formed?"; endpoint = "is this
operation allowed?".

1. **FluentValidation** — input shape (format, range, required, enum
   membership). Runs before the handler. Failure → 400.
2. **Endpoint logic** — domain state (entity exists, caller has a live link
   with the right capability, business rule). Failure → the endpoint writes
   the response (`rules/error-handling.md#send-for-expected-errors`).

## When to add a validator

Required for endpoints with a body (POST/PUT/PATCH) or non-trivial
query/route params. Not needed for no-input endpoints or pure id lookups.
111 validators cover 233 endpoints, which is about the expected ratio.

## Validator class

Inherits FastEndpoints' `Validator<TRequest>` — **not** FluentValidation's
`AbstractValidator<T>`. 110 in `Features/**` do; the single
`AbstractValidator<T>` outlier
(`Features/Trainers/UpdateTrainerProfile/UpdateTrainerProfileValidator.cs`)
is drift, not a permitted second form.

`public class {Action}Validator` is the shipped norm (107 of 113;
`internal sealed` on the 6 template-slice validators). Match the surrounding
slice.

Rules that encode a domain constraint carry `.WithErrorCode(...)` (255 call
sites in `Features/**`) plus a `.WithMessage(...)` fallback. Plain shape
checks (`NotEmpty`, `MaximumLength`) usually don't.

```csharp
/// <summary>
/// Validates the <see cref="CreatePlanRequest"/>.
/// </summary>
public class CreatePlanValidator : Validator<CreatePlanRequest>
{
    /// <summary>
    /// Initializes validation rules for creating a nutrition plan.
    /// </summary>
    public CreatePlanValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.StartDate)
            .Must(d => d!.Value.DayOfWeek == DayOfWeek.Monday)
            .WithErrorCode(ErrorCodes.StartDateNotMonday)
            .WithMessage("Start date must be a Monday.")
            .When(x => x.StartDate.HasValue);
    }
}
```

Validators are constructed by FastEndpoints without DI, so they cannot take
an injected `TimeProvider`; a "not in the past" rule reads `DateTime.UtcNow`
directly. That is accepted here — see `rules/csharp-style.md#timeprovider`.

## Error codes

`public const string` on the **flat** `ErrorCodes` static class at
`Domain/Constants/ErrorCodes.cs` (100 constants, no nested classes — it is
`ErrorCodes.PlanNotFound`, never `ErrorCodes.Plan.NotFound`).

**Values are `SCREAMING_SNAKE_CASE`** — `PLAN_NOT_FOUND`,
`RECIPE_NOT_OWNED`, `START_DATE_NOT_MONDAY`. 98 of 100 follow this; the two
lowercase outliers (`social_email_conflict`, `session_locked`) are drift.
Codes are a stable wire contract consumed as localization keys by web and
mobile — renaming one is a breaking change.

The dotted `"{Domain}.{ErrorName}"` format this file used to prescribe has
**0** occurrences and was removed in #937.

## Testing validators

Unit test with `.TestValidate(...)` — 228 call sites in
`FitnessPlatform.Tests`. No FastEndpoints host needed.

```csharp
var result = new CreatePlanValidator().TestValidate(new CreatePlanRequest { Name = "" });
result.ShouldHaveValidationErrorFor(x => x.Name);
```

**Assert on `ErrorMessage` or `ErrorCode`, not on `PropertyName`.** The
global property-name resolver is camelCased by any test that boots the app,
so a `PropertyName` assertion passes in isolation and flakes under the full
suite.

## What goes where

| Validation type | Where |
|-----------------|-------|
| Required, format, range, enum membership | Validator |
| Entity exists | Endpoint → `Send.NotFoundAsync(ct)` |
| Caller lacks the link / capability | Endpoint → `Send.ForbiddenAsync(ct)`, or `Send.NotFoundAsync(ct)` where existence itself must not leak |
| Business state / state machine | Endpoint → `this.SendProblemAsync(409, ErrorCodes.X, …, ct)` |
| Cross-entity invariants | Endpoint → `this.SendProblemAsync(...)` |

## No magic strings

1. Introduce an `enum` (or `readonly record struct`) on the domain side.
2. Type the request property as that enum, so FastEndpoints' binder converts
   at the edge.
3. Validate membership against the enum — `IsInEnum()` (33 sites),
   `NotEqual(Undefined)`.

`.IsInEnum()` coverage is incomplete — several slices bind an enum request
property without it. Add it to new rules; a missing one on existing code is
a NIT at most.

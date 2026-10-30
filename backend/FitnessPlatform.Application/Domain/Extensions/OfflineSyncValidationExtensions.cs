using System.Linq.Expressions;
using FitnessPlatform.Application.Domain.Constants;
using FluentValidation;

namespace FitnessPlatform.Application.Domain.Extensions;

/// <summary>
/// Shared validation rules for the optional offline-sync fields on client write requests.
/// </summary>
public static class OfflineSyncValidationExtensions
{
    /// <summary>Maximum clock skew allowed for an <c>OccurredAt</c> ahead of the server.</summary>
    public static readonly TimeSpan MaxFutureSkew = TimeSpan.FromMinutes(5);

    /// <summary>Maximum age of an <c>OccurredAt</c>.</summary>
    public static readonly TimeSpan MaxAge = TimeSpan.FromDays(7);

    /// <summary>
    /// Adds the rules for <c>OccurredAt</c> (not more than 5 minutes ahead, not older than 7 days)
    /// and <c>ClientRequestId</c> (not an empty Guid). Both fields are optional.
    /// </summary>
    public static void AddOfflineSyncRules<T>(
        this AbstractValidator<T> validator,
        Expression<Func<T, DateTimeOffset?>> occurredAt,
        Expression<Func<T, Guid?>> clientRequestId)
    {
        validator.RuleFor(occurredAt)
            .Must(value => value!.Value.UtcDateTime <= DateTime.UtcNow.Add(MaxFutureSkew))
            .WithErrorCode(ErrorCodes.OccurredAtInFuture)
            .WithMessage("OccurredAt must not be more than 5 minutes in the future.")
            .Must(value => value!.Value.UtcDateTime >= DateTime.UtcNow.Subtract(MaxAge))
            .WithErrorCode(ErrorCodes.OccurredAtTooOld)
            .WithMessage("OccurredAt must not be older than 7 days.")
            .When(request => occurredAt.Compile()(request).HasValue);

        validator.RuleFor(clientRequestId)
            .NotEqual(Guid.Empty)
            .When(request => clientRequestId.Compile()(request).HasValue);
    }
}

using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Client.PersonalRecords.GetClientRecords;

/// <summary>
/// Validates query parameters for <see cref="GetClientRecordsRequest"/>.
/// </summary>
public class GetClientRecordsValidator : Validator<GetClientRecordsRequest>
{
    private const int MaxPageSize = 100;

    /// <summary>
    /// Initializes a new instance of <see cref="GetClientRecordsValidator"/>.
    /// </summary>
    public GetClientRecordsValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1)
            .WithMessage("Page must be at least 1.");

        RuleFor(x => x.PageSize)
            .GreaterThanOrEqualTo(1)
            .WithMessage("PageSize must be at least 1.")
            .LessThanOrEqualTo(MaxPageSize)
            .WithMessage($"PageSize must not exceed {MaxPageSize}.");
    }
}

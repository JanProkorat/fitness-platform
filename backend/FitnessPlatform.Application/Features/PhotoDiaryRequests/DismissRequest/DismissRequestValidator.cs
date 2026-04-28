using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.DismissRequest;

/// <summary>
/// Validates <see cref="DismissRequestRequest"/> before the endpoint handler executes.
/// </summary>
public class DismissRequestValidator : Validator<DismissRequestRequest>
{
    public DismissRequestValidator()
    {
        RuleFor(x => x.Reason)
            .MaximumLength(500)
            .WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage("Reason must not exceed 500 characters.")
            .When(x => x.Reason is not null);
    }
}

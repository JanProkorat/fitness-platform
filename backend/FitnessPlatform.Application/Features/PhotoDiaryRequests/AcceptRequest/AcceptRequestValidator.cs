using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.AcceptRequest;

/// <summary>
/// Validates <see cref="AcceptRequestRequest"/> before the endpoint handler executes.
/// </summary>
public class AcceptRequestValidator : Validator<AcceptRequestRequest>
{
    public AcceptRequestValidator()
    {
        RuleFor(x => x.Mode)
            .IsInEnum()
            .WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage($"Mode must be a valid {nameof(PhotoDiaryMode)} value.");
    }
}

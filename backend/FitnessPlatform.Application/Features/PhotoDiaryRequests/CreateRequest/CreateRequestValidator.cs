using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.CreateRequest;

/// <summary>
/// Validates <see cref="CreateRequestRequest"/> before the endpoint handler executes.
/// </summary>
public class CreateRequestValidator : Validator<CreateRequestRequest>
{
    public CreateRequestValidator()
    {
        RuleFor(x => x)
            .Must(x => (x.ClientId.HasValue) != (x.PendingInviteId.HasValue))
            .WithErrorCode(ErrorCodes.PhotoDiaryRequestLinkXorInvite)
            .WithMessage("Exactly one of clientId or pendingInviteId must be provided.");

        RuleFor(x => x.DurationDays)
            .InclusiveBetween(1, 30)
            .WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage("DurationDays must be between 1 and 30.");
    }
}

using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.CreateRequest;

/// <summary>
/// Validates <see cref="CreateRequestRequest"/> before the endpoint handler executes.
/// </summary>
public class CreateRequestValidator : Validator<CreateRequestRequest>
{
    /// <summary>Maximum length of the coach's message.</summary>
    public const int MaxMessageLength = 500;

    public CreateRequestValidator()
    {
        RuleFor(x => x)
            .Must(x => (x.ClientId.HasValue) != (x.PendingInviteId.HasValue))
            .WithErrorCode(ErrorCodes.PhotoDiaryRequestLinkXorInvite)
            .WithMessage("Exactly one of clientId or pendingInviteId must be provided.");

        RuleFor(x => x.Mode)
            .IsInEnum()
            .WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage($"Mode must be a valid {nameof(PhotoDiaryMode)} value.");

        RuleFor(x => x.DurationDays)
            .InclusiveBetween(1, 30)
            .WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage("DurationDays must be between 1 and 30.")
            .When(x => x.Mode == PhotoDiaryMode.Workflow);

        RuleFor(x => x.Message)
            .MaximumLength(MaxMessageLength);
    }
}

using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Automations.PauseClientAutomation;

/// <summary>
/// Validates the <see cref="PauseClientAutomationRequest"/>.
/// </summary>
public class PauseClientAutomationValidator : Validator<PauseClientAutomationRequest>
{
    /// <summary>
    /// Initializes validation rules for pausing a rule for a client.
    /// </summary>
    public PauseClientAutomationValidator()
    {
        RuleFor(x => x.ClientId).NotEmpty();
        RuleFor(x => x.RuleId).NotEmpty();
        RuleFor(x => x.PauseNote).MaximumLength(200);

        RuleFor(x => x)
            .Must(x => x.PausedUntil is null && string.IsNullOrWhiteSpace(x.PauseNote))
            .WithErrorCode(ErrorCodes.AutomationPauseDetailsWithoutPause)
            .WithMessage("An end date or note needs a pause.")
            .When(x => !x.IsPaused);

        // Exact check against the client's local date happens in the endpoint; this one rejects dates
        // that are in the past in every time zone.
        RuleFor(x => x.PausedUntil)
            .Must(date => date!.Value >= DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1))
            .WithErrorCode(ErrorCodes.AutomationPausedUntilInPast)
            .WithMessage("The pause cannot end in the past.")
            .When(x => x.PausedUntil.HasValue);
    }
}

using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Users.UpdateNotificationPreferences;

/// <summary>
/// Validates the <see cref="UpdateNotificationPreferencesRequest"/>.
/// </summary>
public class UpdateNotificationPreferencesValidator : Validator<UpdateNotificationPreferencesRequest>
{
    /// <summary>
    /// Initializes validation rules for saving notification preferences.
    /// </summary>
    public UpdateNotificationPreferencesValidator()
    {
        RuleFor(x => x.Preferences)
            .NotNull()
            .WithMessage("Preferences are required.");

        RuleForEach(x => x.Preferences)
            .ChildRules(item => item.RuleFor(p => p.Event).IsInEnum())
            .When(x => x.Preferences is not null);

        RuleFor(x => x.Preferences)
            .Must(list => list.Select(p => p.Event).Distinct().Count() == list.Count)
            .WithMessage("Each notification event may appear only once.")
            .When(x => x.Preferences is not null);

        RuleFor(x => x.Preferences)
            .Must(list => NotificationPreferenceDefaults.AllEvents.All(e => list.Any(p => p.Event == e)))
            .WithMessage("Every notification event must be present.")
            .When(x => x.Preferences is not null);
    }
}

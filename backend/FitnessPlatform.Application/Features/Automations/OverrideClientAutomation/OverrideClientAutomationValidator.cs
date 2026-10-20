using FitnessPlatform.Application.Features.Automations.Shared;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Automations.OverrideClientAutomation;

/// <summary>
/// Validates the <see cref="OverrideClientAutomationRequest"/>.
/// </summary>
public class OverrideClientAutomationValidator : AutomationTriggerBodyValidator<OverrideClientAutomationRequest>
{
    /// <summary>
    /// Initializes validation rules for customising a rule for a client.
    /// </summary>
    public OverrideClientAutomationValidator()
    {
        RuleFor(x => x.ClientId).NotEmpty();
        RuleFor(x => x.RuleId).NotEmpty();
    }
}

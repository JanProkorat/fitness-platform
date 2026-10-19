using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Automations.Shared;

/// <summary>
/// Shape rules for the audience of a global rule, on top of the rule body rules.
/// </summary>
/// <typeparam name="T">The request type carrying a rule body and audience.</typeparam>
public abstract class AutomationAudienceBodyValidator<T> : AutomationRuleBodyValidator<T>
    where T : AutomationAudienceBody
{
    /// <summary>
    /// Initializes the shared audience rules.
    /// </summary>
    protected AutomationAudienceBodyValidator()
    {
        RuleFor(x => x.Audience).IsInEnum().When(x => x.Audience.HasValue);

        RuleFor(x => x.AudienceTagId)
            .NotNull()
            .WithErrorCode(ErrorCodes.AutomationAudienceTagRequired)
            .WithMessage("A tag audience needs a tag.")
            .When(x => x.Audience == AutomationAudience.Tag);

        RuleFor(x => x.AudienceClientIds)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.AutomationAudienceClientsRequired)
            .WithMessage("A chosen audience needs at least one client.")
            .When(x => x.Audience == AutomationAudience.Chosen);

        RuleFor(x => x.AudienceClientIds)
            .Must(ids => ids.Count <= 500)
            .WithMessage("At most 500 clients can be chosen.");
    }
}

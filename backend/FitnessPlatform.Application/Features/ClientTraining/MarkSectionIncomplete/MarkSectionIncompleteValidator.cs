using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientTraining.MarkSectionIncomplete;

/// <summary>
/// Validator for <see cref="MarkSectionIncompleteRequest"/>.
/// </summary>
public class MarkSectionIncompleteValidator : Validator<MarkSectionIncompleteRequest>
{
    /// <summary>
    /// Initializes a new instance of <see cref="MarkSectionIncompleteValidator"/>.
    /// </summary>
    public MarkSectionIncompleteValidator()
    {
        RuleFor(x => x.SessionId)
            .NotEmpty();

        RuleFor(x => x.SectionId)
            .NotEmpty();
    }
}

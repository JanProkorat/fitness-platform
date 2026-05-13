using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientTraining.MarkSectionComplete;

/// <summary>
/// Validator for <see cref="MarkSectionCompleteRequest"/>.
/// </summary>
public class MarkSectionCompleteValidator : Validator<MarkSectionCompleteRequest>
{
    /// <summary>
    /// Initializes a new instance of <see cref="MarkSectionCompleteValidator"/>.
    /// </summary>
    public MarkSectionCompleteValidator()
    {
        RuleFor(x => x.SessionId)
            .NotEmpty();

        RuleFor(x => x.SectionId)
            .NotEmpty();
    }
}

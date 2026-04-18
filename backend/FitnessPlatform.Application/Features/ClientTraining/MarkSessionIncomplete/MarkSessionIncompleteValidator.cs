using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientTraining.MarkSessionIncomplete;

/// <summary>
/// Validator for <see cref="MarkSessionIncompleteRequest"/>.
/// </summary>
public class MarkSessionIncompleteValidator : Validator<MarkSessionIncompleteRequest>
{
    /// <summary>
    /// Initializes a new instance of <see cref="MarkSessionIncompleteValidator"/>.
    /// </summary>
    public MarkSessionIncompleteValidator()
    {
        RuleFor(x => x.SessionId)
            .NotEmpty();
    }
}

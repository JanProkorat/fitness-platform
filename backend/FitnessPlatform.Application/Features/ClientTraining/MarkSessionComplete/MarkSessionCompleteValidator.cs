using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientTraining.MarkSessionComplete;

/// <summary>
/// Validator for <see cref="MarkSessionCompleteRequest"/>.
/// </summary>
public class MarkSessionCompleteValidator : Validator<MarkSessionCompleteRequest>
{
    /// <summary>
    /// Initializes a new instance of <see cref="MarkSessionCompleteValidator"/>.
    /// </summary>
    public MarkSessionCompleteValidator()
    {
        RuleFor(x => x.SessionId)
            .NotEmpty();
    }
}

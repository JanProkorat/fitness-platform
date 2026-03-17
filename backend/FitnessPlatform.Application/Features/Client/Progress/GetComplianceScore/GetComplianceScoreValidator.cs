using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Client.Progress.GetComplianceScore;

/// <summary>
/// Validator for <see cref="GetComplianceScoreRequest"/>.
/// Ensures From is not after To when both are provided.
/// </summary>
public class GetComplianceScoreValidator : Validator<GetComplianceScoreRequest>
{
    /// <summary>
    /// Initializes validation rules for the compliance score request.
    /// </summary>
    public GetComplianceScoreValidator()
    {
        RuleFor(x => x.From)
            .LessThanOrEqualTo(x => x.To)
            .When(x => x.From.HasValue && x.To.HasValue)
            .WithMessage("'From' date must be before or equal to 'To' date.");
    }
}

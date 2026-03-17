using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Trainers.GetClientProgress;

/// <summary>
/// Validator for <see cref="GetClientProgressRequest"/>.
/// Ensures ClientId is provided and date range is valid.
/// </summary>
public class GetClientProgressValidator : Validator<GetClientProgressRequest>
{
    /// <summary>
    /// Initializes validation rules for the client progress request.
    /// </summary>
    public GetClientProgressValidator()
    {
        RuleFor(x => x.ClientId)
            .NotEmpty()
            .WithMessage("ClientId is required.");

        RuleFor(x => x.From)
            .LessThanOrEqualTo(x => x.To)
            .When(x => x.From.HasValue && x.To.HasValue)
            .WithMessage("'From' date must be before or equal to 'To' date.");
    }
}

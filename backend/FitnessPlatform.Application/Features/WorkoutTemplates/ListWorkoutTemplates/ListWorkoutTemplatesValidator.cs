using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.WorkoutTemplates.ListWorkoutTemplates;

/// <summary>
/// Validates <see cref="ListWorkoutTemplatesRequest"/>.
/// </summary>
public class ListWorkoutTemplatesValidator : Validator<ListWorkoutTemplatesRequest>
{
    /// <summary>
    /// Initializes pagination validation rules.
    /// </summary>
    public ListWorkoutTemplatesValidator()
    {
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1).WithMessage("Page must be >= 1.");
        RuleFor(x => x.PageSize).InclusiveBetween(1, 200).WithMessage("PageSize must be between 1 and 200.");
    }
}

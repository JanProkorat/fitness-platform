using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Exercises.SearchExercises;

/// <summary>
/// Validates the <see cref="SearchExercisesRequest"/>.
/// </summary>
public class SearchExercisesValidator : Validator<SearchExercisesRequest>
{
    /// <summary>
    /// Initializes validation rules for exercise search.
    /// </summary>
    public SearchExercisesValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100);
    }
}

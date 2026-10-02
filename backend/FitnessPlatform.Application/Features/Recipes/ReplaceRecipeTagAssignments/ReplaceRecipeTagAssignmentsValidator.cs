using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Recipes.ReplaceRecipeTagAssignments;

/// <summary>
/// Validates the <see cref="ReplaceRecipeTagAssignmentsRequest"/>. Whether each id resolves to a
/// tag the caller owns, and whether the recipe is readable, are endpoint-level checks.
/// </summary>
public class ReplaceRecipeTagAssignmentsValidator : Validator<ReplaceRecipeTagAssignmentsRequest>
{
    private const int MaxTagsPerRecipe = 50;

    /// <summary>
    /// Initializes validation rules for replacing a recipe's tag assignments.
    /// </summary>
    public ReplaceRecipeTagAssignmentsValidator()
    {
        RuleFor(x => x.RecipeId)
            .NotEmpty().WithErrorCode(ErrorCodes.Required);

        // Both Must() rules guard `ids is null` themselves: the default cascade mode continues
        // after NotNull() fails.
        RuleFor(x => x.TagIds)
            .NotNull().WithErrorCode(ErrorCodes.Required)
            .Must(ids => ids is null || ids.Count <= MaxTagsPerRecipe)
            .WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage($"A recipe may have at most {MaxTagsPerRecipe} tags assigned.")
            .Must(ids => ids is null || ids.Distinct().Count() == ids.Count)
            .WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage("TagIds must not contain duplicates.");
    }
}

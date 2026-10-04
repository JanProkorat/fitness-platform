using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Foods.ReplaceFoodTagAssignments;

/// <summary>
/// Validates the <see cref="ReplaceFoodTagAssignmentsRequest"/>. Whether each id resolves to a
/// tag the caller owns, and whether the food itself is visible to the caller, are endpoint-level
/// checks — see <see cref="ReplaceFoodTagAssignmentsEndpoint"/>.
/// </summary>
public class ReplaceFoodTagAssignmentsValidator : Validator<ReplaceFoodTagAssignmentsRequest>
{
    private const int MaxTagsPerFood = 50;

    /// <summary>
    /// Initializes validation rules for replacing a food's tag assignments.
    /// </summary>
    public ReplaceFoodTagAssignmentsValidator()
    {
        RuleFor(x => x.FoodId)
            .NotEmpty().WithErrorCode(ErrorCodes.Required);

        // No CascadeMode is configured anywhere in this backend (default: Continue), so both
        // Must() rules below still run after NotNull() fails — each one guards `ids is null`
        // itself rather than relying on cascade-stop to short-circuit a null body before it
        // reaches them.
        RuleFor(x => x.TagIds)
            .NotNull().WithErrorCode(ErrorCodes.Required)
            .Must(ids => ids is null || ids.Count <= MaxTagsPerFood)
            .WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage($"A food may have at most {MaxTagsPerFood} tags assigned.")
            .Must(ids => ids is null || ids.Distinct().Count() == ids.Count)
            .WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage("TagIds must not contain duplicates.");
    }
}

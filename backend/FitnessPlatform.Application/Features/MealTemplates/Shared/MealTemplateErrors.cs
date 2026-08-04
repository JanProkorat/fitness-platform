using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Extensions;

namespace FitnessPlatform.Application.Features.MealTemplates.Shared;

/// <summary>
/// The meal-template library's single pinned <see cref="LibraryDenial"/> instance — every
/// endpoint in this feature reuses this same value rather than constructing its own, per
/// <see cref="LibraryDenial"/>'s own remarks.
/// </summary>
internal static class MealTemplateErrors
{
    /// <summary>
    /// The meal-template library's 404/403/409 denial strings.
    /// </summary>
    internal static readonly LibraryDenial Denial = new(
        ErrorCodes.MealTemplateNotFound,
        "Meal template not found.",
        ErrorCodes.MealTemplateNotOwned,
        "Meal template belongs to another owner.",
        ErrorCodes.MealTemplateVersionConflict,
        "Meal template was modified by another request.");
}

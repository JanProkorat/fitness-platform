using FormUp.Application.Domain.Constants;
using FormUp.Application.Domain.Extensions;

namespace FormUp.Application.Features.NutritionPlanTemplates.Shared;

/// <summary>
/// Pins the sharing-library denial strings for the nutrition-plan-template library (#861) into
/// a single, reused <see cref="LibraryDenial"/> instance — see that type's remarks for why every
/// call site for a library must share one value rather than re-typing the six strings.
/// </summary>
internal static class NutritionPlanTemplateLibrary
{
    /// <summary>The pinned 404/403/409 denial strings for this library.</summary>
    public static readonly LibraryDenial Denial = new(
        ErrorCodes.NutritionPlanTemplateNotFound,
        "Nutrition plan template not found.",
        ErrorCodes.NutritionPlanTemplateNotOwned,
        "Nutrition plan template belongs to another owner.",
        ErrorCodes.NutritionPlanTemplateVersionConflict,
        "Nutrition plan template was modified by another request.");
}

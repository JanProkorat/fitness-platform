using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Extensions;

namespace FitnessPlatform.Application.Features.TrainingPlanTemplates.Shared;

/// <summary>
/// Pins the sharing-library denial strings for the training-plan-template library (#862) into a
/// single, reused <see cref="LibraryDenial"/> instance — see that type's remarks for why every
/// call site for a library must share one value rather than re-typing the six strings.
/// </summary>
internal static class TrainingPlanTemplateLibrary
{
    /// <summary>The pinned 404/403/409 denial strings for this library.</summary>
    public static readonly LibraryDenial Denial = new(
        ErrorCodes.TrainingPlanTemplateNotFound,
        "Training plan template not found.",
        ErrorCodes.TrainingPlanTemplateNotOwned,
        "Training plan template belongs to another owner.",
        ErrorCodes.TrainingPlanTemplateVersionConflict,
        "Training plan template was modified by another request.");
}

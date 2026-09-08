using FastEndpoints;
using FitnessPlatform.Application.Features.SessionTemplates.Shared;
using FluentValidation;

namespace FitnessPlatform.Application.Features.SessionTemplates.UpdateSessionTemplate;

/// <summary>
/// Validates the <see cref="UpdateSessionTemplateRequest"/> via the shared
/// <see cref="SessionTemplateRuleSet"/> (#892) — mirrors the ordering, format-config, and
/// exercise/set rules the plan write path enforces so a template that validates here never 400s
/// when embedded into a plan via <c>UpdateTrainingPlan</c>.
/// </summary>
internal sealed class UpdateSessionTemplateValidator : Validator<UpdateSessionTemplateRequest>
{
    /// <summary>
    /// Initializes validation rules for session template updates.
    /// </summary>
    public UpdateSessionTemplateValidator()
    {
        SessionTemplateRuleSet.Configure(
            this,
            x => x.Name,
            x => x.Description,
            x => x.Difficulty,
            x => x.EstimatedDurationMinutes,
            x => x.Visibility,
            x => x.Format,
            x => x.FormatConfig,
            x => x.Workouts,
            x => x.StandaloneExercises);
    }
}

using FastEndpoints;
using FitnessPlatform.Application.Features.SessionTemplates.Shared;
using FluentValidation;

namespace FitnessPlatform.Application.Features.SessionTemplates.CreateSessionTemplate;

/// <summary>
/// Validates the <see cref="CreateSessionTemplateRequest"/> via the shared
/// <see cref="SessionTemplateRuleSet"/> (#892) — mirrors the ordering, format-config, and
/// exercise/set rules the plan write path enforces so a template that validates here never 400s
/// when embedded into a plan via <c>UpdateTrainingPlan</c>.
/// </summary>
internal sealed class CreateSessionTemplateValidator : Validator<CreateSessionTemplateRequest>
{
    /// <summary>
    /// Initializes validation rules for session template creation.
    /// </summary>
    public CreateSessionTemplateValidator()
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

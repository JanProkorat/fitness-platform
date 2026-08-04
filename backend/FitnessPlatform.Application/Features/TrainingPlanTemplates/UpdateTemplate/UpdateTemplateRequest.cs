using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.TrainingPlanTemplates.Shared;

namespace FitnessPlatform.Application.Features.TrainingPlanTemplates.UpdateTemplate;

/// <summary>
/// Request for a full-state update of a training plan template: replaces name, description,
/// goal/difficulty, and the week tree.
/// </summary>
public class UpdateTemplateRequest
{
    /// <summary>
    /// The template's public identifier (route parameter).
    /// </summary>
    public Guid TemplateId { get; set; }

    /// <summary>
    /// Updated display name.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Updated free-text description.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Updated primary fitness goal.
    /// </summary>
    public PrimaryGoal? Goal { get; set; }

    /// <summary>
    /// Updated difficulty level.
    /// </summary>
    public ExerciseDifficulty? Difficulty { get; set; }

    /// <summary>
    /// Full week structure to persist. Replaces all existing weeks, days, sessions, workouts,
    /// and exercises.
    /// </summary>
    public List<TemplateWeekRequest> Weeks { get; set; } = [];

    /// <summary>
    /// Expected version for optimistic concurrency control.
    /// </summary>
    public int Version { get; set; }
}

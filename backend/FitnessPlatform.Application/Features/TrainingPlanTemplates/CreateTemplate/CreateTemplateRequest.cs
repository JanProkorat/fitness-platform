using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.TrainingPlanTemplates.Shared;

namespace FitnessPlatform.Application.Features.TrainingPlanTemplates.CreateTemplate;

/// <summary>
/// Request to create a new training plan template — either empty (materialized from
/// <see cref="WeekCount"/>) or with a full week tree supplied directly.
/// </summary>
public class CreateTemplateRequest
{
    /// <summary>
    /// Display name of the template.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional free-text description.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Optional primary fitness goal this template targets.
    /// </summary>
    public PrimaryGoal? Goal { get; set; }

    /// <summary>
    /// Optional difficulty level this template targets.
    /// </summary>
    public ExerciseDifficulty? Difficulty { get; set; }

    /// <summary>
    /// A materialisation instruction for the empty-weeks path: creates this many weeks, each
    /// with all 7 days and no sessions. Mutually exclusive with <see cref="Weeks"/>. Never
    /// persisted as supplied — <see cref="Domain.Documents.TrainingPlanTemplate.WeekCount"/> is
    /// always server-computed from the resulting week tree.
    /// </summary>
    public int? WeekCount { get; set; }

    /// <summary>
    /// A full week tree to persist directly. Mutually exclusive with <see cref="WeekCount"/>.
    /// </summary>
    public List<TemplateWeekRequest>? Weeks { get; set; }

    /// <summary>
    /// Who can read this entry besides the caller. Defaults to <see cref="LibraryVisibility.Private"/>.
    /// </summary>
    public LibraryVisibility Visibility { get; set; } = LibraryVisibility.Private;
}

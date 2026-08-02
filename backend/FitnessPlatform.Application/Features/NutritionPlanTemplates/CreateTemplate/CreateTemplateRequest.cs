using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.NutritionPlanTemplates.Shared;

namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.CreateTemplate;

/// <summary>
/// Request to create a new nutrition plan template — either empty (materialized from
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
    /// Optional dietary style this template targets.
    /// </summary>
    public DietaryStyle? DietaryStyle { get; set; }

    /// <summary>
    /// Optional global daily nutrition targets.
    /// </summary>
    public GlobalNutritionSettings? GlobalSettings { get; set; }

    /// <summary>
    /// Supplement recommendations to carry on the template.
    /// </summary>
    public List<TemplateSupplementRequest> Supplements { get; set; } = [];

    /// <summary>
    /// A materialisation instruction for the empty-weeks path: creates this many weeks, each
    /// with all 7 days and no meals. Mutually exclusive with <see cref="Weeks"/>. Never persisted
    /// as supplied — <see cref="NutritionPlanTemplate.WeekCount"/> is always server-computed from
    /// the resulting week tree.
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

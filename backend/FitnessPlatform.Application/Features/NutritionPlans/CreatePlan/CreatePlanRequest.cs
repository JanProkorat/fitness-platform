using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.NutritionPlans.CreatePlan;

/// <summary>
/// Request to create a new nutrition plan for a client.
/// </summary>
public class CreatePlanRequest
{
    /// <summary>
    /// The client's public user identifier.
    /// </summary>
    public Guid ClientId { get; set; }

    /// <summary>
    /// Display name of the plan.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional global daily nutrition targets.
    /// </summary>
    public GlobalNutritionSettings? GlobalSettings { get; set; }

    /// <summary>
    /// Number of weeks to initialize (default 1).
    /// </summary>
    public int WeekCount { get; set; } = 1;

    /// <summary>
    /// Optional start date for the plan. Must be a Monday and not in the past.
    /// Transmitted as ISO date string (e.g. "2026-03-30"), stored as midnight UTC.
    /// </summary>
    public DateTime? StartDate { get; set; }

    /// <summary>
    /// Optional questionnaire response to link to this plan (cross-DB reference).
    /// Must be a submitted response owned by this professional for the same client.
    /// </summary>
    public Guid? QuestionnaireResponseId { get; set; }

    /// <summary>
    /// Optional primary fitness goal for this plan period.
    /// When set, read sites prefer this value over the client's onboarding baseline.
    /// </summary>
    public PrimaryGoal? Goal { get; set; }

    /// <summary>
    /// Optional target body weight in kilograms for this plan period.
    /// Must be greater than zero when provided.
    /// </summary>
    public decimal? TargetWeightKg { get; set; }
}

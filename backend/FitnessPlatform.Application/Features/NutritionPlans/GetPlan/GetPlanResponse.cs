using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.NutritionPlans.GetPlan;

/// <summary>
/// Detailed nutrition plan response including all weeks, days, meals, and foods.
/// </summary>
public class GetPlanResponse
{
    /// <summary>
    /// Plan's public identifier.
    /// </summary>
    public Guid PlanId { get; set; }

    /// <summary>
    /// Client's public user identifier.
    /// </summary>
    public Guid ClientId { get; set; }

    /// <summary>
    /// Nutritionist's public user identifier.
    /// </summary>
    public Guid NutritionistId { get; set; }

    /// <summary>
    /// Display name of the plan.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Current plan status as string (Draft, Active, Archived).
    /// </summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Global daily nutrition targets.
    /// </summary>
    public GlobalNutritionSettings? GlobalSettings { get; set; }

    /// <summary>
    /// All weeks in the plan with their days, meals, and foods.
    /// </summary>
    public List<PlanWeek> Weeks { get; set; } = [];

    /// <summary>
    /// Optimistic concurrency version.
    /// </summary>
    public int Version { get; set; }

    /// <summary>
    /// When the plan was created.
    /// </summary>
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// When the plan was last updated.
    /// </summary>
    public DateTime? DateUpdated { get; set; }

    /// <summary>
    /// Maps a <see cref="NutritionPlan"/> document to a detailed response DTO.
    /// </summary>
    /// <param name="plan">The nutrition plan document.</param>
    /// <returns>A detailed response DTO.</returns>
    public static GetPlanResponse FromDocument(NutritionPlan plan) => new()
    {
        PlanId = plan.ExternalId,
        ClientId = plan.ClientId,
        NutritionistId = plan.NutritionistId,
        Name = plan.Name,
        Status = plan.Status.ToString(),
        GlobalSettings = plan.GlobalSettings,
        Weeks = plan.Weeks,
        Version = plan.Version,
        DateCreated = plan.DateCreated,
        DateUpdated = plan.DateUpdated
    };
}

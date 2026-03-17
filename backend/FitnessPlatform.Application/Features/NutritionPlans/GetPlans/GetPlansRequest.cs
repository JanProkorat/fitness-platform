using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.NutritionPlans.GetPlans;

/// <summary>
/// Request to list nutrition plans with optional filters and pagination.
/// </summary>
public class GetPlansRequest
{
    /// <summary>
    /// Optional filter by client's public user identifier.
    /// </summary>
    public Guid? ClientId { get; set; }

    /// <summary>
    /// Optional filter by plan status.
    /// </summary>
    public NutritionPlanStatus? Status { get; set; }

    /// <summary>
    /// Page number (1-based).
    /// </summary>
    public int Page { get; set; } = 1;

    /// <summary>
    /// Number of items per page.
    /// </summary>
    public int PageSize { get; set; } = 20;
}

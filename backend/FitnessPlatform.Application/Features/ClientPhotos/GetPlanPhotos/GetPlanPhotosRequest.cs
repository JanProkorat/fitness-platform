using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.ClientPlans.GetPlanPhotos;

/// <summary>
/// Request model for listing plan photos with optional category filter and pagination.
/// </summary>
public class GetPlanPhotosRequest
{
    /// <summary>
    /// Route: the plan's public identifier.
    /// </summary>
    public Guid PlanId { get; set; }

    /// <summary>
    /// Optional category filter (Food / Body / FreeForm).
    /// When null, all categories are returned.
    /// </summary>
    public PlanPhotoCategory? Category { get; set; }

    /// <summary>
    /// 1-based page number (default 1).
    /// </summary>
    public int Page { get; set; } = 1;

    /// <summary>
    /// Number of items per page (default 20, max 100).
    /// </summary>
    public int PageSize { get; set; } = 20;
}

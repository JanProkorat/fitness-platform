using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.ClientPhotos.GetMyPhotos;

/// <summary>
/// Query parameters for <c>GET /client/me/photos</c>.
/// </summary>
public class GetMyPhotosRequest
{
    /// <summary>
    /// Optional category filter (Food / Body / FreeForm).
    /// </summary>
    public PlanPhotoCategory? Category { get; set; }

    /// <summary>
    /// Optional inclusive lower bound on <c>TakenAt</c> (UTC).
    /// </summary>
    public DateTime? From { get; set; }

    /// <summary>
    /// Optional inclusive upper bound on <c>TakenAt</c> (UTC).
    /// </summary>
    public DateTime? To { get; set; }

    /// <summary>
    /// Page number (1-based). Defaults to 1.
    /// </summary>
    public int Page { get; set; } = 1;

    /// <summary>
    /// Number of items per page. Defaults to 20.
    /// </summary>
    public int PageSize { get; set; } = 20;

    /// <summary>
    /// When <c>true</c> the response items are <see cref="Common.MonthGroupResponse"/> objects
    /// grouped by <c>YYYY-MM</c>. When <c>false</c> (default) items are flat
    /// <see cref="Common.PlanPhotoResponse"/> objects.
    /// Pagination applies to groups when <c>true</c>, to individual photos when <c>false</c>.
    /// </summary>
    public bool GroupByMonth { get; set; }
}

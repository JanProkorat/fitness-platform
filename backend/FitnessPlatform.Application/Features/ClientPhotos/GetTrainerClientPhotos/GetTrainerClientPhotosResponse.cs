using FitnessPlatform.Application.Features.ClientPhotos.Common;

namespace FitnessPlatform.Application.Features.ClientPhotos.GetTrainerClientPhotos;

/// <summary>
/// Response for <c>GET /trainer/clients/{id}/photos</c>.
/// <para>
/// <b>Design decision — discriminated response in a single envelope:</b>
/// The endpoint serves two shapes depending on the <c>groupByMonth</c> query flag
/// rather than splitting into two routes, because the filtering/auth logic is
/// identical and a single URL is easier to cache and document.
/// Exactly one of <see cref="Photos"/> or <see cref="Groups"/> will be non-null in any response:
/// <list type="bullet">
///   <item><c>groupByMonth=false</c> (default): <see cref="Photos"/> is populated,
///     <see cref="Groups"/> is null. Pagination applies to individual photos.</item>
///   <item><c>groupByMonth=true</c>: <see cref="Groups"/> is populated,
///     <see cref="Photos"/> is null. Pagination applies to month groups (one page = N groups).</item>
/// </list>
/// The <c>X-Total-Count</c> response header always reflects the total count of the
/// active collection (photos or groups).
/// </para>
/// </summary>
public class GetTrainerClientPhotosResponse
{
    /// <summary>
    /// Flat list of photo records. Populated when <c>groupByMonth=false</c>.
    /// </summary>
    public List<PlanPhotoResponse>? Photos { get; set; }

    /// <summary>
    /// Month-grouped list of photo records. Populated when <c>groupByMonth=true</c>.
    /// </summary>
    public List<MonthGroupResponse>? Groups { get; set; }
}

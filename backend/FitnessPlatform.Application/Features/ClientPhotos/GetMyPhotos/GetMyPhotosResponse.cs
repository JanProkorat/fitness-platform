using FitnessPlatform.Application.Features.ClientPhotos.Common;

namespace FitnessPlatform.Application.Features.ClientPhotos.GetMyPhotos;

/// <summary>
/// Response for <c>GET /client/me/photos</c>.
/// <para>
/// Uses the same discriminated-envelope design as the trainer variant:
/// exactly one of <see cref="Photos"/> or <see cref="Groups"/> is non-null.
/// </para>
/// </summary>
public class GetMyPhotosResponse
{
    /// <summary>
    /// Flat list of photo records. Populated when <c>groupByMonth=false</c>.
    /// </summary>
    public List<ClientPhotoResponse>? Photos { get; set; }

    /// <summary>
    /// Month-grouped list of photo records. Populated when <c>groupByMonth=true</c>.
    /// </summary>
    public List<MonthGroupResponse>? Groups { get; set; }
}

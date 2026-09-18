using FitnessPlatform.Application.Features.ClientTags.Shared;

namespace FitnessPlatform.Application.Features.ClientTags.GetClientTags;

/// <summary>
/// The tags owned by the calling professional.
/// </summary>
public class GetClientTagsResponse
{
    /// <summary>
    /// The caller's tags, ordered by name.
    /// </summary>
    public List<ClientTagDto> Tags { get; set; } = [];
}

namespace FitnessPlatform.Application.Features.ClientTags.UpdateClientTag;

/// <summary>
/// Request body for renaming, recoloring, or redescribing a client tag. <c>TagId</c> is bound from
/// the route.
/// </summary>
public class UpdateClientTagRequest
{
    /// <summary>
    /// Public identifier of the tag to update, from the route.
    /// </summary>
    public Guid TagId { get; set; }

    /// <summary>
    /// Tag label. Unique per owning professional.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional free-text description.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Display color as a 6-digit hex string, e.g. <c>"#3b82f6"</c>.
    /// </summary>
    public string ColorHex { get; set; } = string.Empty;
}

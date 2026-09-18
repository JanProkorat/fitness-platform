namespace FitnessPlatform.Application.Features.ClientTags.CreateClientTag;

/// <summary>
/// Request body for creating a client tag owned by the calling professional.
/// </summary>
public class CreateClientTagRequest
{
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

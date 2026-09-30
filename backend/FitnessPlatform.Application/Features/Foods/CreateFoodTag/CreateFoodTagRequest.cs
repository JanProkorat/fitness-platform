namespace FitnessPlatform.Application.Features.Foods.CreateFoodTag;

/// <summary>
/// Request body for creating a food tag owned by the calling nutritionist.
/// </summary>
public class CreateFoodTagRequest
{
    /// <summary>
    /// Tag label. Unique (case-insensitive) per owning nutritionist.
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

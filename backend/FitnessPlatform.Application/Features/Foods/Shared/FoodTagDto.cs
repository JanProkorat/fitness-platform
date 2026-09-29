using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.Foods.Shared;

/// <summary>
/// A single food tag, as returned by every action in the food-tags slice and embedded as a chip
/// on <see cref="FoodSummary"/>.
/// </summary>
public class FoodTagDto
{
    /// <summary>
    /// Public identifier of the tag.
    /// </summary>
    public Guid TagId { get; set; }

    /// <summary>
    /// Tag label.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional free-text description.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Display color as a lowercase 6-digit hex string, e.g. <c>"#3b82f6"</c>.
    /// </summary>
    public string ColorHex { get; set; } = string.Empty;

    /// <summary>
    /// Projects a <see cref="FoodTag"/> document to its API shape.
    /// </summary>
    /// <param name="tag">The tag document to project.</param>
    public static FoodTagDto FromDocument(FoodTag tag) => new()
    {
        TagId = tag.ExternalId,
        Name = tag.Name,
        Description = tag.Description,
        ColorHex = tag.ColorHex,
    };
}

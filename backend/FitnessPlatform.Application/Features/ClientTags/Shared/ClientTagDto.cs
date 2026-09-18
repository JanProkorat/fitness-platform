using FitnessPlatform.Application.Domain.Entities;

namespace FitnessPlatform.Application.Features.ClientTags.Shared;

/// <summary>
/// A single client tag, as returned by every action in the <c>ClientTags</c> slice.
/// </summary>
public class ClientTagDto
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
    /// Projects a <see cref="ClientTag"/> entity to its API shape.
    /// </summary>
    /// <param name="tag">The tag entity to project.</param>
    public static ClientTagDto FromEntity(ClientTag tag) => new()
    {
        TagId = tag.PublicId,
        Name = tag.Name,
        Description = tag.Description,
        ColorHex = tag.ColorHex,
    };
}

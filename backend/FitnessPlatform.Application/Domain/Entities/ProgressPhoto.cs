using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Represents a progress photo uploaded by or for a client, stored in blob storage.
/// </summary>
public class ProgressPhoto : PublicTimestampableEntity
{
    /// <summary>
    /// Foreign key to the <see cref="ClientProfile"/>.
    /// </summary>
    public long ClientProfileId { get; set; }

    /// <summary>
    /// URL to the photo in blob storage (MinIO / Azure Blob Storage).
    /// </summary>
    [MaxLength(250)]
    public string BlobUrl { get; set; } = string.Empty;

    /// <summary>
    /// Optional description of the photo.
    /// </summary>
    [MaxLength(500)]
    public string? Description { get; set; }

    /// <summary>
    /// Date and time when the photo was taken.
    /// </summary>
    public DateTime TakenAt { get; set; }

    /// <summary>
    /// Navigation property to the client profile.
    /// </summary>
    public ClientProfile ClientProfile { get; set; } = null!;
}

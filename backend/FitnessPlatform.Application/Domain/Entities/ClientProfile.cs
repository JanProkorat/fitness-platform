using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Profile information for users in the Client role.
/// </summary>
public class ClientProfile : PublicTimestampableEntity
{
    /// <summary>
    /// Foreign key to the associated <see cref="ApplicationUser"/>.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Client's date of birth.
    /// </summary>
    public DateTime? DateOfBirth { get; set; }

    /// <summary>
    /// Client's height in centimeters.
    /// </summary>
    public decimal? HeightCm { get; set; }

    /// <summary>
    /// Client's current weight in kilograms.
    /// </summary>
    public decimal? WeightKg { get; set; }

    /// <summary>
    /// Client's fitness or health goals.
    /// </summary>
    [MaxLength(500)]
    public string? Goals { get; set; }

    /// <summary>
    /// Medical notes relevant to training and nutrition (GDPR Art. 9 special category).
    /// </summary>
    [MaxLength(500)]
    public string? MedicalNotes { get; set; }

    /// <summary>
    /// Navigation property to the associated user.
    /// </summary>
    public ApplicationUser User { get; set; } = null!;

    /// <summary>
    /// Collection of links to trainers/nutritionists managing this client.
    /// </summary>
    public ICollection<ClientTrainerLink> TrainerLinks { get; set; } = [];

    /// <summary>
    /// Collection of body measurements recorded for this client.
    /// </summary>
    public ICollection<BodyMeasurement> BodyMeasurements { get; set; } = [];

    /// <summary>
    /// Collection of progress photos uploaded for this client.
    /// </summary>
    public ICollection<ProgressPhoto> ProgressPhotos { get; set; } = [];
}

using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// An embedded sub-document representing a supplement recommendation within a
/// <see cref="NutritionPlan"/>. Coaches add supplements to guide client compliance;
/// clients see the list read-only and may configure local reminders on mobile.
/// </summary>
public class Supplement
{
    /// <summary>
    /// Stable public identifier. Generated client-side on creation; preserved across
    /// full-state PUT updates so mobile reminders keyed on this id survive round-trips.
    /// </summary>
    [BsonElement("externalId")]
    public Guid ExternalId { get; set; }

    /// <summary>
    /// Name of the supplement (e.g. "Vitamin D3", "Omega-3"). Required.
    /// </summary>
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional dosage instruction in free text (e.g. "1 capsule with breakfast").
    /// </summary>
    [BsonElement("dose")]
    public string? Dose { get; set; }

    /// <summary>
    /// Optional additional notes for the client (e.g. "Take with a fatty meal").
    /// </summary>
    [BsonElement("notes")]
    public string? Notes { get; set; }
}

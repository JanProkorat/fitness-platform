using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// Stores food names in supported languages for localization.
/// </summary>
public class LocalizedNames
{
    /// <summary>
    /// English name.
    /// </summary>
    [BsonElement("en")]
    public string? En { get; set; }

    /// <summary>
    /// Czech name.
    /// </summary>
    [BsonElement("cs")]
    public string? Cs { get; set; }

    /// <summary>
    /// German name.
    /// </summary>
    [BsonElement("de")]
    public string? De { get; set; }

    /// <summary>
    /// Resolves the best name for the given language, falling back to English, then any available name.
    /// </summary>
    /// <param name="language">Two-letter language code (e.g. "cs", "de", "en").</param>
    /// <returns>The best available name, or <c>null</c> if none set.</returns>
    public string? Resolve(string? language)
    {
        var preferred = language?.ToLowerInvariant() switch
        {
            "cs" => Cs,
            "de" => De,
            "en" => En,
            _ => null
        };

        return preferred ?? En ?? Cs ?? De;
    }
}

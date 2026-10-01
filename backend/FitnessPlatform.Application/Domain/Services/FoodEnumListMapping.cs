namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Maps between the enum lists exposed on food request/response DTOs (<c>List&lt;Allergen&gt;</c>,
/// <c>List&lt;DietaryPreference&gt;</c>) and the plain <c>List&lt;string&gt;</c> storage on
/// <see cref="FitnessPlatform.Application.Domain.Documents.Food"/>. Storage stays stringly-typed so a
/// legacy dev DB populated before this enum existed keeps deserializing — <see cref="ParseStoredNames{TEnum}"/>
/// is deliberately lenient (case-insensitive, unknown values dropped) rather than throwing.
/// </summary>
public static class FoodEnumListMapping
{
    /// <summary>
    /// Legacy stored spellings that don't match an enum name even case-insensitively. Covers
    /// pre-existing dev-DB documents seeded before <c>seed-foods.json</c>'s "tree nuts" → "treenuts"
    /// fix; new writes never produce this spelling.
    /// </summary>
    private static readonly Dictionary<string, string> LegacyAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["tree nuts"] = nameof(Domain.Enums.Allergen.TreeNuts)
    };

    /// <summary>
    /// Converts an enum list to the plain string names stored on the document.
    /// </summary>
    public static List<string> ToStoredNames<TEnum>(IEnumerable<TEnum> values)
        where TEnum : struct, Enum =>
        values.Select(v => v.ToString()).ToList();

    /// <summary>
    /// Parses stored string names back into enum values. A stored value that (after alias
    /// resolution) still doesn't match a known enum name is skipped rather than thrown — an
    /// unrecognized legacy value must not 500 a read.
    /// </summary>
    public static List<TEnum> ParseStoredNames<TEnum>(IEnumerable<string> storedValues)
        where TEnum : struct, Enum
    {
        var result = new List<TEnum>();

        foreach (var raw in storedValues)
        {
            var candidate = LegacyAliases.GetValueOrDefault(raw, raw);

            if (Enum.TryParse<TEnum>(candidate, ignoreCase: true, out var parsed))
            {
                result.Add(parsed);
            }
        }

        return result;
    }
}

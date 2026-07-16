using System.Text.Json;

namespace FitnessPlatform.Application.Infrastructure.Data.MongoDb;

/// <summary>
/// Loads and deserializes the embedded JSON seed data resources under
/// <c>FitnessPlatform.Application/Seed/Data/</c> (registered as <c>&lt;EmbeddedResource&gt;</c>
/// in the .csproj). Shared by <see cref="FoodSeedData"/>, <see cref="RecipeSeedData"/>,
/// <see cref="ExerciseSeedData"/>, and <see cref="WorkoutTemplateSeedData"/>.
/// </summary>
internal static class SeedJsonLoader
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    /// <summary>
    /// Deserializes the named embedded JSON resource into a list of <typeparamref name="T"/>.
    /// Resolves the resource by suffix match (rather than a hardcoded full logical name) so the
    /// lookup survives root-namespace changes — mirrors <c>QaSeedRunner.LoadEmbeddedAsset</c>.
    /// </summary>
    /// <param name="fileName">The file name as it appears under <c>Seed/Data/</c>, e.g. <c>"seed-foods.json"</c>.</param>
    /// <param name="validateEntry">
    /// Optional per-entry validation, invoked once per deserialized entry with its zero-based
    /// index. Callers use this to fail fast with a clear message on a null/empty required field
    /// (slug, names, etc.) instead of letting the null surface as an NRE deep in the seeding
    /// pipeline — see #810 review finding M4. Use <see cref="RequireNonEmpty"/> inside the
    /// callback.
    /// </param>
    public static List<T> Load<T>(string fileName, Action<T, int>? validateEntry = null)
    {
        var assembly = typeof(SeedJsonLoader).Assembly;
        var resourceName = assembly.GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith(fileName, StringComparison.Ordinal));

        if (resourceName is null)
        {
            throw new InvalidOperationException(
                $"Embedded seed resource {fileName} not found. Did the .csproj <EmbeddedResource> entry land?");
        }

        using var stream = assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException(
                $"Could not open embedded resource stream for {fileName}.");

        var entries = JsonSerializer.Deserialize<List<T>>(stream, Options)
            ?? throw new InvalidOperationException($"Failed to deserialize {fileName} — resource is empty or malformed.");

        if (validateEntry is not null)
        {
            for (var i = 0; i < entries.Count; i++)
            {
                validateEntry(entries[i], i);
            }
        }

        return entries;
    }

    /// <summary>
    /// Throws a clear <see cref="InvalidOperationException"/> if <paramref name="value"/> is
    /// null, empty, or whitespace-only. Intended for use inside a <c>validateEntry</c> callback
    /// passed to <see cref="Load{T}"/>.
    /// </summary>
    /// <param name="value">The field value to check.</param>
    /// <param name="fieldName">The field's name, for the error message (use <c>nameof(...)</c>).</param>
    /// <param name="fileName">The seed JSON file name the entry came from.</param>
    /// <param name="index">The entry's zero-based index within the file.</param>
    /// <param name="slugHint">
    /// The entry's slug, if already known/validated — included in the error message to make the
    /// offending entry easy to find. Pass <c>null</c> when validating the slug field itself.
    /// </param>
    public static void RequireNonEmpty(string? value, string fieldName, string fileName, int index, string? slugHint = null)
    {
        if (!string.IsNullOrWhiteSpace(value))
        {
            return;
        }

        var slugPart = slugHint is null ? string.Empty : $" (slug '{slugHint}')";
        throw new InvalidOperationException(
            $"{fileName}[{index}]{slugPart}: required field '{fieldName}' is null, empty, or whitespace.");
    }
}

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
    public static List<T> Load<T>(string fileName)
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

        return JsonSerializer.Deserialize<List<T>>(stream, Options)
            ?? throw new InvalidOperationException($"Failed to deserialize {fileName} — resource is empty or malformed.");
    }
}

using System.Text.RegularExpressions;

namespace FitnessPlatform.Application.Features.Recipes.Shared;

/// <summary>
/// Builds and parses recipe image blob keys of the form <c>{slot}-{guid:N}.{ext}</c>.
/// </summary>
public static partial class RecipeImageKeys
{
    /// <summary>Main image slot name.</summary>
    public const string MainSlot = "main";

    /// <summary>Gallery image slot name.</summary>
    public const string GallerySlot = "gallery";

    [GeneratedRegex("^(main|gallery)-([0-9a-f]{32})\\.[a-z]{3,4}$")]
    private static partial Regex KeyPattern();

    /// <summary>Returns a new unique sub-path <c>{recipeId}/{slot}-{guid:N}.{extension}</c>.</summary>
    public static string NewSubPath(Guid recipeId, string slot, string extension) =>
        $"{recipeId}/{slot}-{Guid.NewGuid():N}.{extension}";

    /// <summary>
    /// Parses the last path segment of <paramref name="blobUrl"/>; succeeds only when the slot prefix equals
    /// <paramref name="slot"/> and the rest is a 32-hex guid plus a 3-4 letter extension.
    /// </summary>
    public static bool TryParse(string blobUrl, string slot, out Guid keyId)
    {
        keyId = Guid.Empty;
        var lastSegment = blobUrl[(blobUrl.LastIndexOf('/') + 1)..];
        var match = KeyPattern().Match(lastSegment);

        if (!match.Success || match.Groups[1].Value != slot)
        {
            return false;
        }

        return Guid.TryParseExact(match.Groups[2].Value, "N", out keyId);
    }
}

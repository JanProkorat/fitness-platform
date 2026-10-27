using System.Text.RegularExpressions;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Builds and parses avatar blob names. Every upload gets a fresh name, so a replaced photo never
/// sits behind a cached URL: <c>prof-{profileId}-{guid:N}.{ext}</c> for professionals and
/// <c>{userId}-{guid:N}.{ext}</c> for users. Names without the guid part are the legacy fixed form.
/// </summary>
public static partial class AvatarBlobKeys
{
    private const string Extension = "[a-z]{3,4}";
    private const string KeySuffix = "[0-9a-f]{32}";

    [GeneratedRegex($"^prof-(\\d+)(?:-({KeySuffix}))?\\.{Extension}\\z")]
    private static partial Regex ProfessionalPattern();

    [GeneratedRegex($"^([0-9a-f]{{8}}-[0-9a-f]{{4}}-[0-9a-f]{{4}}-[0-9a-f]{{4}}-[0-9a-f]{{12}})(?:-({KeySuffix}))?\\.{Extension}\\z")]
    private static partial Regex UserPattern();

    /// <summary>Returns a new unique sub-path <c>prof-{profileId}-{guid:N}.{extension}</c>.</summary>
    public static string NewProfessionalSubPath(long profileId, string extension) =>
        $"prof-{profileId}-{Guid.NewGuid():N}.{extension}";

    /// <summary>Returns a new unique sub-path <c>{userId}-{guid:N}.{extension}</c>.</summary>
    public static string NewUserSubPath(Guid userId, string extension) =>
        $"{userId}-{Guid.NewGuid():N}.{extension}";

    /// <summary>
    /// Parses the last segment of <paramref name="blobUrl"/> as a unique key of this professional.
    /// On success <paramref name="key"/> is the extension-less name <c>prof-{profileId}-{guid:N}</c>.
    /// </summary>
    public static bool TryParseProfessionalKey(string? blobUrl, long profileId, out string key) =>
        TryParse(ProfessionalPattern(), blobUrl, profileId.ToString(), allowLegacy: false, out key, out _);

    /// <summary>
    /// Parses the last segment of <paramref name="blobUrl"/> as a unique key of this user.
    /// On success <paramref name="key"/> is the extension-less name <c>{userId}-{guid:N}</c>.
    /// </summary>
    public static bool TryParseUserKey(string? blobUrl, Guid userId, out string key) =>
        TryParse(UserPattern(), blobUrl, userId.ToString(), allowLegacy: false, out key, out _);

    /// <summary>
    /// Returns the last segment of a stored professional avatar URL when it is this professional's
    /// legacy fixed name or unique name; otherwise false.
    /// </summary>
    public static bool TryGetOwnedProfessionalSegment(string? blobUrl, long profileId, out string segment) =>
        TryParse(ProfessionalPattern(), blobUrl, profileId.ToString(), allowLegacy: true, out _, out segment);

    /// <summary>
    /// Returns the last segment of a stored user avatar URL when it is this user's legacy fixed
    /// name or unique name; otherwise false.
    /// </summary>
    public static bool TryGetOwnedUserSegment(string? blobUrl, Guid userId, out string segment) =>
        TryParse(UserPattern(), blobUrl, userId.ToString(), allowLegacy: true, out _, out segment);

    private static bool TryParse(
        Regex pattern,
        string? blobUrl,
        string ownerId,
        bool allowLegacy,
        out string key,
        out string segment)
    {
        key = string.Empty;
        segment = string.Empty;

        if (string.IsNullOrWhiteSpace(blobUrl))
        {
            return false;
        }

        var lastSegment = blobUrl[(blobUrl.LastIndexOf('/') + 1)..];
        var match = pattern.Match(lastSegment);

        if (!match.Success || match.Groups[1].Value != ownerId)
        {
            return false;
        }

        if (!match.Groups[2].Success && !allowLegacy)
        {
            return false;
        }

        segment = lastSegment;
        key = lastSegment[..lastSegment.LastIndexOf('.')];
        return true;
    }
}

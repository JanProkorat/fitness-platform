namespace FitnessPlatform.Application.Domain.Extensions;

/// <summary>
/// Small helper extensions for <see cref="string"/> values commonly used in
/// request-to-document mapping.
/// </summary>
public static class StringExtensions
{
    /// <summary>
    /// Returns <c>null</c> if the string is null, empty, or whitespace-only;
    /// otherwise returns the original value.
    /// </summary>
    public static string? NullIfEmpty(this string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}

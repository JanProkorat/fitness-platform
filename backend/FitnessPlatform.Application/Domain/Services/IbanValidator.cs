using System.Text.RegularExpressions;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Normalizes, validates (format + ISO 7064 mod-97) and masks IBANs.
/// </summary>
public static partial class IbanValidator
{
    private const int MinLength = 15;
    private const int MaxLength = 34;

    /// <summary>
    /// Strips whitespace and upper-cases the value. Returns an empty string for null input.
    /// </summary>
    /// <param name="iban">Raw IBAN as typed by the user.</param>
    public static string Normalize(string? iban) =>
        string.IsNullOrWhiteSpace(iban)
            ? string.Empty
            : new string(iban.Where(character => !char.IsWhiteSpace(character)).ToArray()).ToUpperInvariant();

    /// <summary>
    /// Whether the value is a well-formed IBAN with a correct mod-97 check. Normalizes first.
    /// </summary>
    /// <param name="iban">Raw or normalized IBAN.</param>
    public static bool IsValid(string? iban)
    {
        var normalized = Normalize(iban);

        if (normalized.Length is < MinLength or > MaxLength || !ShapeRegex().IsMatch(normalized))
        {
            return false;
        }

        var remainder = 0;

        foreach (var character in string.Concat(normalized.AsSpan(4), normalized.AsSpan(0, 4)))
        {
            var digits = char.IsDigit(character) ? character - '0' : character - 'A' + 10;

            remainder = digits >= 10
                ? (remainder * 100 + digits) % 97
                : (remainder * 10 + digits) % 97;
        }

        return remainder == 1;
    }

    /// <summary>
    /// Masks a normalized IBAN for logs-adjacent surfaces (audit rows, emails): country and
    /// check digits, then the last four characters.
    /// </summary>
    /// <param name="normalizedIban">A normalized IBAN.</param>
    public static string Mask(string normalizedIban) =>
        normalizedIban.Length < 8
            ? "****"
            : $"{normalizedIban[..4]} **** {normalizedIban[^4..]}";

    [GeneratedRegex("^[A-Z]{2}[0-9]{2}[A-Z0-9]+$")]
    private static partial Regex ShapeRegex();
}

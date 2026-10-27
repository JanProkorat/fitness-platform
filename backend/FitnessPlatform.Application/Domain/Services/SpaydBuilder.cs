using System.Globalization;
using System.Text;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Builds the SPAYD string behind a Czech QR Platba code, within the limits of the specification.
/// </summary>
public static class SpaydBuilder
{
    /// <summary>Largest payable amount; the AM field holds at most ten characters.</summary>
    public const decimal MaxAmount = 9_999_999.99m;

    /// <summary>Longest MSG value, counted before percent-encoding.</summary>
    public const int MaxMessageLength = 60;

    /// <summary>Longest RN value, counted before percent-encoding.</summary>
    public const int MaxRecipientNameLength = 35;

    /// <summary>Longest X-VS value.</summary>
    public const int MaxVariableSymbolLength = 10;

    private static readonly Dictionary<char, string> Transliterations = new()
    {
        ['ß'] = "ss", ['ł'] = "l", ['Ł'] = "L", ['đ'] = "d", ['Đ'] = "D", ['ø'] = "o", ['Ø'] = "O",
        ['æ'] = "ae", ['Æ'] = "AE", ['œ'] = "oe", ['Œ'] = "OE", ['ð'] = "d", ['Ð'] = "D", ['þ'] = "th",
        ['Þ'] = "TH", ['ı'] = "i", ['ħ'] = "h", ['Ħ'] = "H"
    };

    /// <summary>
    /// Builds the SPAYD string. The account is the IBAN only; the amount is written with two decimals
    /// whatever the current culture; text fields are stripped to ASCII, cut to their limit and any
    /// asterisk percent-encoded; optional fields that are null are left out.
    /// </summary>
    /// <param name="iban">The recipient's IBAN, with or without spaces.</param>
    /// <param name="amount">The amount in <paramref name="currency"/>, above zero and at most <see cref="MaxAmount"/>.</param>
    /// <param name="variableSymbol">Up to ten digits, or null.</param>
    /// <param name="message">The transfer message, or null.</param>
    /// <param name="dueDate">The due date, or null.</param>
    /// <param name="recipientName">The account holder's name, or null.</param>
    /// <param name="currency">The currency of the amount, written as the CC field.</param>
    public static string Build(
        string iban,
        decimal amount,
        string? variableSymbol,
        string? message,
        DateOnly? dueDate,
        string? recipientName,
        PaymentCurrency currency = PaymentCurrency.CZK)
    {
        var account = IbanValidator.Normalize(iban);

        if (account.Length == 0)
        {
            throw new ArgumentException("The IBAN is required.", nameof(iban));
        }

        if (amount <= 0m || amount > MaxAmount)
        {
            throw new ArgumentOutOfRangeException(nameof(amount), amount, "The amount must be above zero and at most 9999999.99.");
        }

        var builder = new StringBuilder("SPD*1.0");
        builder.Append("*ACC:").Append(account);
        builder.Append("*AM:").Append(amount.ToString("0.00", CultureInfo.InvariantCulture));
        builder.Append("*CC:").Append(currency);

        if (dueDate is { } due)
        {
            builder.Append("*DT:").Append(due.ToString("yyyyMMdd", CultureInfo.InvariantCulture));
        }

        if (!string.IsNullOrWhiteSpace(message))
        {
            builder.Append("*MSG:").Append(Escape(Cut(ToAscii(message), MaxMessageLength)));
        }

        if (!string.IsNullOrWhiteSpace(recipientName))
        {
            builder.Append("*RN:").Append(Escape(Cut(ToAscii(recipientName), MaxRecipientNameLength)));
        }

        if (variableSymbol is not null)
        {
            if (variableSymbol.Length is 0 or > MaxVariableSymbolLength || !variableSymbol.All(char.IsAsciiDigit))
            {
                throw new ArgumentException("The variable symbol must be one to ten digits.", nameof(variableSymbol));
            }

            builder.Append("*X-VS:").Append(variableSymbol);
        }

        return builder.ToString();
    }

    /// <summary>
    /// Strips diacritics and replaces every other character outside printable ASCII with a space, then
    /// collapses runs of spaces and trims.
    /// </summary>
    /// <param name="text">The text to fold.</param>
    public static string ToAscii(string text)
    {
        var folded = new StringBuilder(text.Length);

        foreach (var character in Decompose(text))
        {
            if (Transliterations.TryGetValue(character, out var replacement))
            {
                folded.Append(replacement);
            }
            else if (char.GetUnicodeCategory(character) == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }
            else
            {
                folded.Append(character is >= ' ' and <= '~' ? character : ' ');
            }
        }

        return string.Join(' ', folded.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    private static string Decompose(string text)
    {
        try
        {
            return text.Normalize(NormalizationForm.FormD);
        }
        catch (PlatformNotSupportedException)
        {
            return text;
        }
    }

    private static string Cut(string text, int limit) =>
        text.Length <= limit ? text : text[..limit].TrimEnd();

    private static string Escape(string text) =>
        text.Replace("%", "%25", StringComparison.Ordinal).Replace("*", "%2A", StringComparison.Ordinal);
}

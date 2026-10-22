using System.Net;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Composes the transfer message of a payment and the localized text of the payment request email.
/// Month names and number formats are spelled out here instead of read from the runtime culture, so
/// the output does not depend on the ICU data of the host.
/// </summary>
public static class PaymentMessageComposer
{
    /// <summary>Content id of the QR image inside the request email.</summary>
    public const string QrContentId = "payment-qr@formup.local";

    private const char NonBreakingSpace = ' ';

    private static readonly Dictionary<string, string[]> MonthNames = new()
    {
        ["en"] = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
        ["cs"] = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"],
        ["de"] = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"]
    };

    private static readonly Dictionary<string, string> SubjectFormats = new()
    {
        ["en"] = "{0}: {1} for {2}, due {3}",
        ["cs"] = "{0}: {1} za {2}, splatnost {3}",
        ["de"] = "{0}: {1} für {2}, fällig {3}"
    };

    private static readonly Dictionary<string, string> HeadingFormats = new()
    {
        ["en"] = "{0} for {1}",
        ["cs"] = "{0} za {1}",
        ["de"] = "{0} für {1}"
    };

    private static readonly Dictionary<string, string> IntroFormats = new()
    {
        ["en"] = "{0}, due {1}. Pay by bank transfer — scan the code in your bank app, or copy the details.",
        ["cs"] = "{0}, splatnost {1}. Zaplaťte bankovním převodem — naskenujte kód v bankovní aplikaci, nebo opište údaje.",
        ["de"] = "{0}, fällig am {1}. Zahlen Sie per Überweisung — scannen Sie den Code in Ihrer Banking-App oder übernehmen Sie die Angaben."
    };

    private static readonly Dictionary<string, string> BreakdownFormats = new()
    {
        ["en"] = "Package price {0}, {1}.",
        ["cs"] = "Cena balíčku {0}, {1}.",
        ["de"] = "Paketpreis {0}, {1}."
    };

    /// <summary>
    /// Composes the transfer message the bank shows: ASCII only, at most 60 characters, with the month
    /// kept when the text has to be cut.
    /// </summary>
    /// <param name="format">How the message is composed.</param>
    /// <param name="packageNameOrTitle">The package name, or the title of a one-off payment.</param>
    /// <param name="clientFirstName">The client's first name.</param>
    /// <param name="clientLastName">The client's last name.</param>
    /// <param name="referenceDate">Any day of the payment's month.</param>
    public static string Compose(
        PaymentMessageFormat format,
        string packageNameOrTitle,
        string clientFirstName,
        string clientLastName,
        DateOnly referenceDate)
    {
        var month = $"{referenceDate.Month:D2}/{referenceDate.Year:D4}";

        return format switch
        {
            PaymentMessageFormat.PackageName => Truncate(SpaydBuilder.ToAscii(packageNameOrTitle), SpaydBuilder.MaxMessageLength),
            PaymentMessageFormat.ClientNameAndMonth => WithMonth(SpaydBuilder.ToAscii($"{clientFirstName} {clientLastName}"), month),
            _ => WithMonth(SpaydBuilder.ToAscii(packageNameOrTitle), month)
        };
    }

    /// <summary>
    /// Formats an amount for people: thousands grouped with a non-breaking space, no decimals for a whole
    /// amount, two decimals otherwise, followed by the currency symbol ("Kč", "€"); English puts "€" in front.
    /// </summary>
    /// <param name="amount">The amount.</param>
    /// <param name="language">Two-letter language code; picks the decimal separator.</param>
    /// <param name="currency">The currency of the amount.</param>
    public static string FormatAmount(decimal amount, string language, PaymentCurrency currency = PaymentCurrency.CZK)
    {
        var rounded = Math.Round(amount, 2, MidpointRounding.AwayFromZero);
        var whole = (long)Math.Truncate(rounded);
        var cents = (int)((rounded - whole) * 100m);
        var digits = whole.ToString(System.Globalization.CultureInfo.InvariantCulture);
        var grouped = new System.Text.StringBuilder();

        for (var i = 0; i < digits.Length; i++)
        {
            if (i > 0 && (digits.Length - i) % 3 == 0)
            {
                grouped.Append(NonBreakingSpace);
            }

            grouped.Append(digits[i]);
        }

        if (cents != 0)
        {
            grouped.Append(Normalize(language) == "en" ? '.' : ',').Append(cents.ToString("D2", System.Globalization.CultureInfo.InvariantCulture));
        }

        var symbol = CurrencySymbol(currency);

        return currency == PaymentCurrency.EUR && Normalize(language) == "en"
            ? grouped.Insert(0, symbol).ToString()
            : grouped.Append(NonBreakingSpace).Append(symbol).ToString();
    }

    /// <summary>
    /// The symbol a currency is written with: "Kč" or "€".
    /// </summary>
    /// <param name="currency">The currency.</param>
    public static string CurrencySymbol(PaymentCurrency currency) =>
        currency == PaymentCurrency.EUR ? "€" : "Kč";

    /// <summary>
    /// Formats a date in the reader's convention: "1. 11. 2026", "01.11.2026" or "1 November 2026".
    /// </summary>
    /// <param name="date">The date.</param>
    /// <param name="language">Two-letter language code.</param>
    public static string FormatDate(DateOnly date, string language) =>
        Normalize(language) switch
        {
            "cs" => $"{date.Day}. {date.Month}. {date.Year}",
            "de" => $"{date.Day:D2}.{date.Month:D2}.{date.Year:D4}",
            _ => $"{date.Day} {MonthNames["en"][date.Month - 1]} {date.Year}"
        };

    /// <summary>
    /// Names a payment's period: "listopad 2026" for a calendar month, two dates for any other period,
    /// the title for a payment with no period.
    /// </summary>
    /// <param name="periodStart">First day of the period, or null.</param>
    /// <param name="periodEnd">Last day of the period, or null.</param>
    /// <param name="title">Used when there is no period.</param>
    /// <param name="language">Two-letter language code.</param>
    public static string PeriodLabel(DateOnly? periodStart, DateOnly? periodEnd, string title, string language)
    {
        if (periodStart is not { } start)
        {
            return title;
        }

        var lang = Normalize(language);
        var isCalendarMonth = start.Day == 1
            && periodEnd is { } end
            && end == new DateOnly(start.Year, start.Month, DateTime.DaysInMonth(start.Year, start.Month));

        if (isCalendarMonth)
        {
            return $"{MonthNames[lang][start.Month - 1]} {start.Year}";
        }

        return periodEnd is { } last && last != start
            ? $"{FormatDate(start, lang)} – {FormatDate(last, lang)}"
            : FormatDate(start, lang);
    }

    /// <summary>
    /// Groups an IBAN in fours for reading: "CZ65 0800 0000 1920 0014 5399".
    /// </summary>
    /// <param name="iban">A normalized IBAN.</param>
    public static string FormatIban(string iban) =>
        string.Join(' ', Enumerable.Range(0, (iban.Length + 3) / 4).Select(i => iban.Substring(i * 4, Math.Min(4, iban.Length - (i * 4)))));

    /// <summary>
    /// The subject line of the payment request email.
    /// </summary>
    /// <param name="model">The email content.</param>
    /// <param name="language">Two-letter language code.</param>
    public static string EmailSubject(PaymentRequestEmail model, string language)
    {
        var lang = Normalize(language);

        return string.Format(
            System.Globalization.CultureInfo.InvariantCulture,
            SubjectFormats[lang],
            model.CoachName,
            FormatAmount(model.Amount, lang, model.Currency),
            PeriodLabel(model.PeriodStart, model.PeriodEnd, model.PackageName, lang),
            FormatDate(model.DueDate, lang));
    }

    /// <summary>
    /// Fills the payment request template. Every value is HTML-encoded; the template carries the labels.
    /// </summary>
    /// <param name="template">The localized HTML template.</param>
    /// <param name="model">The email content.</param>
    /// <param name="language">Two-letter language code.</param>
    /// <param name="appUrl">Link behind the "open in the app" button.</param>
    public static string RenderEmailHtml(string template, PaymentRequestEmail model, string language, string appUrl)
    {
        var lang = Normalize(language);
        var amount = FormatAmount(model.Amount, lang, model.Currency);
        var period = PeriodLabel(model.PeriodStart, model.PeriodEnd, model.PackageName, lang);
        var due = FormatDate(model.DueDate, lang);

        var heading = string.Format(System.Globalization.CultureInfo.InvariantCulture, HeadingFormats[lang], amount, model.PackageName);
        var intro = string.Format(System.Globalization.CultureInfo.InvariantCulture, IntroFormats[lang], Capitalize(period), due);
        var breakdown = model.BasePrice is { } basePrice && !string.IsNullOrWhiteSpace(model.DiscountLabel)
            ? string.Format(System.Globalization.CultureInfo.InvariantCulture, BreakdownFormats[lang], FormatAmount(basePrice, lang, model.Currency), model.DiscountLabel)
            : string.Empty;

        return template
            .Replace("{{Heading}}", WebUtility.HtmlEncode(heading), StringComparison.Ordinal)
            .Replace("{{Intro}}", WebUtility.HtmlEncode(intro), StringComparison.Ordinal)
            .Replace("{{Amount}}", WebUtility.HtmlEncode(amount), StringComparison.Ordinal)
            .Replace("{{Iban}}", WebUtility.HtmlEncode(FormatIban(model.Iban)), StringComparison.Ordinal)
            .Replace("{{VariableSymbol}}", WebUtility.HtmlEncode(model.VariableSymbol), StringComparison.Ordinal)
            .Replace("{{Message}}", WebUtility.HtmlEncode(model.Message), StringComparison.Ordinal)
            .Replace("{{Due}}", WebUtility.HtmlEncode(due), StringComparison.Ordinal)
            .Replace("{{Breakdown}}", WebUtility.HtmlEncode(breakdown), StringComparison.Ordinal)
            .Replace("{{CoachName}}", WebUtility.HtmlEncode(model.CoachName), StringComparison.Ordinal)
            .Replace("{{QrCid}}", WebUtility.HtmlEncode(model.QrContentId), StringComparison.Ordinal)
            .Replace("{{AppUrl}}", WebUtility.HtmlEncode(appUrl), StringComparison.Ordinal);
    }

    private static string WithMonth(string text, string month)
    {
        if (text.Length == 0)
        {
            return month;
        }

        var room = SpaydBuilder.MaxMessageLength - month.Length - 1;

        return $"{Truncate(text, room)} {month}";
    }

    private static string Truncate(string text, int limit) =>
        text.Length <= limit ? text : text[..limit].TrimEnd();

    private static string Capitalize(string text) =>
        text.Length == 0 ? text : char.ToUpperInvariant(text[0]) + text[1..];

    private static string Normalize(string? language)
    {
        var code = string.IsNullOrWhiteSpace(language) || language.Length < 2 ? "en" : language[..2].ToLowerInvariant();

        return code is "cs" or "de" ? code : "en";
    }
}

using System.Collections.Concurrent;
using System.Globalization;
using System.Net;
using System.Reflection;
using System.Text.RegularExpressions;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Domain.Interfaces;

namespace FormUp.Application.Infrastructure.Services;

/// <summary>
/// Turns an email template into a finished message: loads the localized body, wraps it in the shared layout
/// (logo, card, footer, hidden preheader) and fills the placeholders. Used by both email providers.
/// </summary>
/// <param name="configuration">Application configuration; supplies the public asset base URL for the logo.</param>
public sealed partial class EmailTemplateRenderer(IConfiguration configuration)
{
    /// <summary>Template name of the email address verification email.</summary>
    public const string EmailVerification = "EmailVerification";

    /// <summary>Template name of the password reset email.</summary>
    public const string PasswordReset = "PasswordReset";

    /// <summary>Template name of the client invitation email.</summary>
    public const string Invitation = "Invitation";

    /// <summary>Template name of the payment request email.</summary>
    public const string PaymentRequest = "PaymentRequest";

    /// <summary>Template name of the bank account changed notice.</summary>
    public const string BankAccountChanged = "BankAccountChanged";

    /// <summary>Template name of the bank account re-authentication code email.</summary>
    public const string ReauthCode = "ReauthCode";

    /// <summary>Template name of the weekly check-in submitted email.</summary>
    public const string CheckIn = "CheckIn";

    /// <summary>Template name of the join request email.</summary>
    public const string JoinRequest = "JoinRequest";

    /// <summary>Template name of the progress photos submitted email.</summary>
    public const string Photos = "Photos";

    /// <summary>Template name of the workout finished email.</summary>
    public const string Workout = "Workout";

    private const string ResourcePrefix = "FormUp.Application.Infrastructure.EmailTemplates.";
    private const string LogoPath = "/email/formup-logo.png";

    private static readonly HashSet<string> SupportedLanguages = ["en", "cs", "de"];

    private static readonly ConcurrentDictionary<string, string> ResourceCache = new();

    private static readonly Dictionary<string, Dictionary<string, string>> Subjects = new()
    {
        [Invitation] = new()
        {
            ["en"] = "{{TrainerName}} invited you to Form Up",
            ["cs"] = "{{TrainerName}} vás zve do Form Up",
            ["de"] = "{{TrainerName}} hat Sie zu Form Up eingeladen"
        },
        [PasswordReset] = new()
        {
            ["en"] = "Reset your Form Up password",
            ["cs"] = "Obnovení hesla ve Form Up",
            ["de"] = "Form-Up-Passwort zurücksetzen"
        },
        [EmailVerification] = new()
        {
            ["en"] = "Confirm your email for Form Up",
            ["cs"] = "Potvrďte svůj e-mail pro Form Up",
            ["de"] = "Bestätigen Sie Ihre E-Mail für Form Up"
        },
        [ReauthCode] = new()
        {
            ["en"] = "Your Form Up confirmation code",
            ["cs"] = "Potvrzovací kód pro Form Up",
            ["de"] = "Ihr Bestätigungscode für Form Up"
        },
        [BankAccountChanged] = new()
        {
            ["en"] = "Your Form Up bank account was changed",
            ["cs"] = "Bankovní účet ve Form Up byl změněn",
            ["de"] = "Ihr Bankkonto bei Form Up wurde geändert"
        },
        [CheckIn] = new()
        {
            ["en"] = "{{ClientFirstName}} sent a weekly check-in",
            ["cs"] = "Nový týdenní check-in: {{ClientFirstName}}",
            ["de"] = "Neuer Wochen-Check-in: {{ClientFirstName}}"
        },
        [JoinRequest] = new()
        {
            ["en"] = "{{ClientName}} wants to work with you",
            ["cs"] = "Nová žádost o spolupráci: {{ClientName}}",
            ["de"] = "Neue Anfrage: {{ClientName}} möchte mit Ihnen zusammenarbeiten"
        },
        [Photos] = new()
        {
            ["en"] = "New photos from {{ClientFirstName}}",
            ["cs"] = "Nové fotky: {{ClientFirstName}}",
            ["de"] = "Neue Fotos von {{ClientFirstName}}"
        },
        [Workout] = new()
        {
            ["en"] = "{{ClientFirstName}} finished a workout",
            ["cs"] = "Dokončený trénink: {{ClientFirstName}}",
            ["de"] = "Training beendet: {{ClientFirstName}}"
        }
    };

    /// <summary>
    /// Normalizes a language code to a supported two-letter code. Falls back to "en".
    /// </summary>
    /// <param name="language">The raw language string (e.g. "cs", "cs-CZ", "de-DE").</param>
    public static string NormalizeLanguage(string? language)
    {
        if (string.IsNullOrWhiteSpace(language))
        {
            return "en";
        }

        var code = language.Length >= 2 ? language[..2].ToLowerInvariant() : language.ToLowerInvariant();

        return SupportedLanguages.Contains(code) ? code : "en";
    }

    /// <summary>
    /// Renders a template and its subject. Plain values are HTML-encoded, raw values are inserted as given,
    /// and placeholders are replaced in a single pass so a value containing a placeholder is never expanded.
    /// </summary>
    /// <param name="template">One of the template name constants.</param>
    /// <param name="language">The recipient's language; unsupported values fall back to English.</param>
    /// <param name="values">Plain-text values by placeholder name; they are HTML-encoded.</param>
    /// <param name="rawValues">Pre-built HTML (or URLs) by placeholder name, inserted as is.</param>
    /// <param name="footerLine">Optional HTML line shown above the brand line in the footer.</param>
    public (string Subject, string Html) Render(
        string template,
        string? language,
        IReadOnlyDictionary<string, string>? values = null,
        IReadOnlyDictionary<string, string>? rawValues = null,
        string footerLine = "")
    {
        var lang = NormalizeLanguage(language);
        var html = Substitute(Wrap(template, lang, footerLine), values, rawValues, encode: true);
        var subjectFormat = Subjects[template].GetValueOrDefault(lang, Subjects[template]["en"]);

        return (Substitute(subjectFormat, values, null, encode: false), html);
    }

    /// <summary>
    /// The template body inside the shared layout, with the body placeholders still unresolved.
    /// </summary>
    /// <param name="template">One of the template name constants.</param>
    /// <param name="language">A supported language code (en, cs, de).</param>
    /// <param name="footerLine">Optional HTML line shown above the brand line in the footer.</param>
    public string Wrap(string template, string language, string footerLine = "")
    {
        var lang = NormalizeLanguage(language);
        var (body, preheader, footnote) = Split(LoadResource(template, lang));
        var layoutValues = new Dictionary<string, string>
        {
            ["Logo"] = LogoHtml(),
            ["Preheader"] = preheader,
            ["FooterNote"] = footnote,
            ["FooterLine"] = footerLine.Length == 0 ? string.Empty : footerLine + "<br>"
        };

        return PlaceholderPattern().Replace(LoadResource("Layout", lang), match =>
            match.Groups[1].Value == "Body" ? body : layoutValues.GetValueOrDefault(match.Groups[1].Value, match.Value));
    }

    /// <summary>
    /// Renders the client invitation email.
    /// </summary>
    /// <param name="trainerName">Display name of the inviting coach.</param>
    /// <param name="acceptUrl">Absolute link that accepts the invitation.</param>
    /// <param name="language">The recipient's language.</param>
    /// <param name="personalMessage">The coach's optional note.</param>
    /// <param name="package">The package offered with the invitation, if any.</param>
    public (string Subject, string Html) RenderInvitation(
        string trainerName, string acceptUrl, string? language, string? personalMessage, InvitationPackageInfo? package)
    {
        var lang = NormalizeLanguage(language);
        var firstName = FirstName(trainerName);

        return Render(
            Invitation,
            lang,
            new Dictionary<string, string>
            {
                ["TrainerName"] = trainerName,
                ["TrainerFirstName"] = firstName,
                ["TrainerInitials"] = Initials(trainerName),
                ["AcceptUrl"] = acceptUrl
            },
            new Dictionary<string, string>
            {
                ["PackageBlock"] = InvitationPackageBlock.Render(package, lang),
                ["PersonalMessage"] = PersonalMessageBlock(personalMessage, lang, firstName)
            });
    }

    /// <summary>
    /// The template that carries an event's email, or null when the event has no email template yet.
    /// </summary>
    /// <param name="notificationEvent">The notification event.</param>
    public static string? TemplateFor(NotificationEvent notificationEvent) => notificationEvent switch
    {
        NotificationEvent.WeeklyCheckInSubmitted => CheckIn,
        NotificationEvent.JoinRequest => JoinRequest,
        NotificationEvent.ProgressPhotosSubmitted => Photos,
        NotificationEvent.WorkoutFinished => Workout,
        _ => null
    };

    /// <summary>
    /// Renders a coach notification email. Optional blocks (stat tiles, quoted notes, the client card) are built
    /// here from the plain values and left empty when their values are missing.
    /// </summary>
    /// <param name="item">The queued notification.</param>
    public (string Subject, string Html) RenderNotification(NotificationEmailWorkItem item)
    {
        var template = TemplateFor(item.Event)
            ?? throw new NotSupportedException($"No email template for notification event {item.Event}.");
        var lang = NormalizeLanguage(item.Language);
        var values = new Dictionary<string, string>(item.Values);
        var clientName = values.GetValueOrDefault(NotificationEmailWorkItem.ClientNameKey, string.Empty);
        var firstName = FirstName(clientName);

        values["ClientFirstName"] = firstName;
        values["ClientInitials"] = Initials(clientName);

        var raw = new Dictionary<string, string>();

        switch (item.Event)
        {
            case NotificationEvent.WeeklyCheckInSubmitted:
                raw["Tiles"] = StatTiles(Tile(values, NotificationEmailWorkItem.WeightKey, lang, "Weight", "Váha", "Gewicht"));
                break;
            case NotificationEvent.JoinRequest:
                raw["ClientCard"] = ClientCard(clientName, values.GetValueOrDefault(NotificationEmailWorkItem.PackageNameKey), lang);
                raw["MessageBlock"] = QuoteBlock(
                    values.GetValueOrDefault(NotificationEmailWorkItem.MessageKey), Localize(lang, "Message", "Zpráva", "Nachricht"));
                break;
            case NotificationEvent.ProgressPhotosSubmitted:
                values["PhotoLead"] = PhotoLead(clientName, values, lang);
                break;
            case NotificationEvent.WorkoutFinished:
                values["WorkoutLead"] = string.Join(" · ", new[]
                    {
                        clientName,
                        values.GetValueOrDefault(NotificationEmailWorkItem.SessionNameKey),
                        values.GetValueOrDefault(NotificationEmailWorkItem.PlanNameKey)
                    }.Where(part => !string.IsNullOrWhiteSpace(part)));
                raw["Tiles"] = StatTiles(
                    Tile(values, NotificationEmailWorkItem.DurationMinutesKey, lang, "Duration", "Délka", "Dauer", " min"),
                    Tile(values, NotificationEmailWorkItem.ExerciseCountKey, lang, "Exercises", "Cviky", "Übungen"),
                    Tile(values, NotificationEmailWorkItem.SetCountKey, lang, "Sets", "Série", "Sätze"));
                raw["NoteBlock"] = QuoteBlock(
                    values.GetValueOrDefault(NotificationEmailWorkItem.NoteKey), Localize(lang, "Note", "Poznámka", "Notiz"));
                break;
        }

        return Render(template, lang, values, raw);
    }

    private static string Localize(string language, string en, string cs, string de) =>
        language switch
        {
            "cs" => cs,
            "de" => de,
            _ => en
        };

    private static (string Label, string Value)? Tile(
        IReadOnlyDictionary<string, string> values, string key, string language, string en, string cs, string de, string suffix = "") =>
        values.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value)
            ? (Localize(language, en, cs, de), value + suffix)
            : null;

    private static string StatTiles(params (string Label, string Value)?[] tiles)
    {
        var present = tiles.Where(tile => tile is not null).Select(tile => tile!.Value).ToList();

        if (present.Count == 0)
        {
            return string.Empty;
        }

        var cells = string.Join(
            """<td width="10" style="font-size:0;line-height:0;">&nbsp;</td>""",
            present.Select(tile => $"""
                <td class="fu-rule" valign="top" style="padding:14px 16px;border:1px solid #E7E4DE;border-radius:14px;">
                  <p class="fu-muted" style="margin:0 0 4px;font-size:12px;color:#6B6863;">{WebUtility.HtmlEncode(tile.Label)}</p>
                  <p class="fu-text" style="margin:0;font-family:'Outfit','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:600;color:#141414;">{WebUtility.HtmlEncode(tile.Value)}</p>
                </td>
                """));

        return $"""
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>{cells}</tr>
              </table>
              """;
    }

    private static string QuoteBlock(string? text, string label)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return string.Empty;
        }

        return $"""
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td class="fu-panel" style="background-color:#F6F4F0;border-radius:14px;padding:14px 16px;">
                    <p class="fu-muted" style="margin:0 0 6px;font-size:12px;font-weight:600;color:#6B6863;">{WebUtility.HtmlEncode(label)}</p>
                    <p class="fu-text" style="margin:0;font-size:15px;line-height:1.55;color:#141414;">&ldquo;{WebUtility.HtmlEncode(text)}&rdquo;</p>
                  </td>
                </tr>
              </table>
              """;
    }

    private static string ClientCard(string clientName, string? packageName, string language)
    {
        var detail = string.IsNullOrWhiteSpace(packageName)
            ? string.Empty
            : $"""<p class="fu-muted" style="margin:2px 0 0;font-size:13px;color:#6B6863;">{Localize(language, "Package", "Balíček", "Paket")}: {WebUtility.HtmlEncode(packageName)}</p>""";

        return $"""
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td class="fu-btn" width="40" height="40" align="center" style="width:40px;height:40px;border-radius:20px;background-color:#141414;color:#FFFFFF;font-size:14px;font-weight:600;">{WebUtility.HtmlEncode(Initials(clientName))}</td>
                  <td style="padding-left:12px;">
                    <p class="fu-text" style="margin:0;font-size:15px;font-weight:700;color:#141414;">{WebUtility.HtmlEncode(clientName)}</p>
                    {detail}
                  </td>
                </tr>
              </table>
              """;
    }

    private static string PhotoLead(string clientName, IReadOnlyDictionary<string, string> values, string language)
    {
        var count = int.TryParse(values.GetValueOrDefault(NotificationEmailWorkItem.PhotoCountKey), out var parsed) ? parsed : 0;
        var summary = language switch
        {
            "cs" => count == 1 ? "1 fotku" : count is >= 2 and <= 4 ? $"{count} fotky" : $"{count} fotek",
            "de" => count == 1 ? "1 Foto" : $"{count} Fotos",
            _ => count == 1 ? "1 photo" : $"{count} photos"
        };
        var hasDate = DateOnly.TryParseExact(
            values.GetValueOrDefault(NotificationEmailWorkItem.RequestDateKey),
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var parsedDate);
        var requestDate = hasDate
            ? parsedDate.ToString(Localize(language, "d MMM yyyy", "d. M. yyyy", "dd.MM.yyyy"), CultureInfo.InvariantCulture)
            : string.Empty;

        return language switch
        {
            "cs" => $"{clientName} · odesláno {summary}. " + (hasDate ? $"Odpověď na vaši žádost z {requestDate}." : "Odpověď na vaši žádost o fotky."),
            "de" => $"{clientName} · {summary} gesendet. " + (hasDate ? $"Antwort auf Ihre Anfrage vom {requestDate}." : "Antwort auf Ihre Fotoanfrage."),
            _ => $"{clientName} · {summary} sent. " + (hasDate ? $"In reply to your request from {requestDate}." : "In reply to your photo request.")
        };
    }

    /// <summary>
    /// The quoted note from the coach; empty when there is no note.
    /// </summary>
    /// <param name="message">The note, or null.</param>
    /// <param name="language">A supported language code (en, cs, de).</param>
    /// <param name="trainerFirstName">The coach's first name for the label.</param>
    internal static string PersonalMessageBlock(string? message, string language, string trainerFirstName)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return string.Empty;
        }

        var label = language switch
        {
            "cs" => "Osobní zpráva",
            "de" => "Persönliche Nachricht",
            _ => $"Message from {WebUtility.HtmlEncode(trainerFirstName)}"
        };

        return $"""
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td class="fu-panel" style="background-color:#F6F4F0;border-radius:14px;padding:14px 16px;">
                    <p class="fu-muted" style="margin:0 0 6px;font-size:12px;font-weight:600;color:#6B6863;">{label}</p>
                    <p class="fu-text" style="margin:0;font-size:15px;line-height:1.55;color:#141414;">&ldquo;{WebUtility.HtmlEncode(message)}&rdquo;</p>
                  </td>
                </tr>
              </table>
              """;
    }

    private static string FirstName(string fullName) =>
        fullName.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).FirstOrDefault() ?? fullName;

    private static string Initials(string fullName)
    {
        var parts = fullName.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        return parts.Length == 0
            ? string.Empty
            : string.Concat(parts.Take(2).Select(part => char.ToUpperInvariant(part[0])));
    }

    private string LogoHtml()
    {
        var assetBaseUrl = configuration[ConfigKeys.EmailAssetBaseUrl]?.Trim().TrimEnd('/');

        if (string.IsNullOrEmpty(assetBaseUrl))
        {
            return """<span class="fu-text" style="font-size:20px;font-weight:300;letter-spacing:4px;color:#141414;">FORM <span style="color:#C8382F;">UP</span></span>""";
        }

        var source = WebUtility.HtmlEncode(assetBaseUrl + LogoPath);

        return $"""
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:5px;line-height:0;"><img src="{source}" width="30" height="27" alt="F" style="display:block;border:0;font-size:20px;color:#C8382F;"></td>
                  <td class="fu-text" style="font-size:20px;font-weight:300;letter-spacing:4px;color:#141414;">ORM <span style="color:#C8382F;">UP</span></td>
                </tr>
              </table>
              """;
    }

    private static string Substitute(
        string text,
        IReadOnlyDictionary<string, string>? values,
        IReadOnlyDictionary<string, string>? rawValues,
        bool encode) =>
        PlaceholderPattern().Replace(text, match =>
        {
            var name = match.Groups[1].Value;

            if (rawValues is not null && rawValues.TryGetValue(name, out var raw))
            {
                return raw;
            }

            if (values is not null && values.TryGetValue(name, out var plain))
            {
                return encode ? WebUtility.HtmlEncode(plain) : plain;
            }

            return match.Value;
        });

    private static (string Body, string Preheader, string Footnote) Split(string template)
    {
        var preheader = string.Empty;
        var footnote = string.Empty;

        var body = MetaPattern().Replace(template, match =>
        {
            if (match.Groups[1].Value == "preheader")
            {
                preheader = match.Groups[2].Value;
            }
            else
            {
                footnote = match.Groups[2].Value;
            }

            return string.Empty;
        });

        return (body.Trim(), preheader, footnote);
    }

    private static string LoadResource(string name, string language)
    {
        var assembly = Assembly.GetExecutingAssembly();

        return ResourceCache.GetOrAdd($"{name}.{language}", _ =>
        {
            using var stream = assembly.GetManifestResourceStream($"{ResourcePrefix}{name}.{language}.html")
                ?? assembly.GetManifestResourceStream($"{ResourcePrefix}{name}.en.html")
                ?? throw new InvalidOperationException($"Email template '{name}.en.html' not found in embedded resources.");
            using var reader = new StreamReader(stream);

            return reader.ReadToEnd();
        });
    }

    [GeneratedRegex(@"\{\{(\w+)\}\}")]
    private static partial Regex PlaceholderPattern();

    [GeneratedRegex(@"<!--\s*(preheader|footnote):\s*(.*?)\s*-->", RegexOptions.Singleline)]
    private static partial Regex MetaPattern();
}

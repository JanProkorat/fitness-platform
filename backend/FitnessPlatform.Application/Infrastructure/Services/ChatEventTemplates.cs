using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Per-type, per-language fallback text for a <see cref="Domain.Entities.ChatMessage"/> with
/// <see cref="ChatMessageKind.Event"/>. Mirrors <see cref="NotificationTemplates"/>'s small
/// in-code lookup table, but resolves to a single interpolated line (a chat message has one
/// <c>Text</c> field, not a title/body pair) written into the CLIENT's
/// <see cref="Domain.Entities.ApplicationUser.Language"/> at write time — see
/// <c>ConversationSeedService.AppendCooperationEventAsync</c>.
/// </summary>
/// <remarks>
/// Wording is third-person, actor-agnostic ("{actorName} sent an invite") rather than
/// second-person ("X invited you") — the actor can be either the professional or the client
/// (e.g. a client-side "Requested"/"Withdrawn" event), and this same fallback line also seeds
/// <c>Conversation.LastMessageText</c> for mobile's raw-text preview, which either participant
/// may read. A perspective-aware ("you"/"they") wording would need to know the reader, which
/// this write-time fallback does not.
/// <para>
/// Fallback language is "en", matching <see cref="NotificationTemplates"/>'s #788 precedent: a
/// null/unrecognized stored <see cref="Domain.Entities.ApplicationUser.Language"/> resolves to
/// English.
/// </para>
/// </remarks>
public static class ChatEventTemplates
{
    private const string FallbackLanguage = "en";

    private static readonly Dictionary<string, Dictionary<ChatEventType, string>> Templates = new()
    {
        ["en"] = new()
        {
            [ChatEventType.Invited] = "{actorName} sent an invite to collaborate.",
            [ChatEventType.Requested] = "{actorName} requested to collaborate.",
            [ChatEventType.Accepted] = "{actorName} accepted the collaboration.",
            [ChatEventType.Declined] = "{actorName} declined the collaboration.",
            [ChatEventType.Withdrawn] = "{actorName} withdrew the collaboration.",
        },
        ["cs"] = new()
        {
            [ChatEventType.Invited] = "{actorName} odeslal(a) pozvánku ke spolupráci.",
            [ChatEventType.Requested] = "{actorName} požádal(a) o spolupráci.",
            [ChatEventType.Accepted] = "{actorName} přijal(a) spolupráci.",
            [ChatEventType.Declined] = "{actorName} odmítl(a) spolupráci.",
            [ChatEventType.Withdrawn] = "{actorName} zrušil(a) spolupráci.",
        },
        ["de"] = new()
        {
            [ChatEventType.Invited] = "{actorName} hat eine Einladung zur Zusammenarbeit gesendet.",
            [ChatEventType.Requested] = "{actorName} hat um Zusammenarbeit gebeten.",
            [ChatEventType.Accepted] = "{actorName} hat die Zusammenarbeit angenommen.",
            [ChatEventType.Declined] = "{actorName} hat die Zusammenarbeit abgelehnt.",
            [ChatEventType.Withdrawn] = "{actorName} hat die Zusammenarbeit zurückgezogen.",
        },
    };

    /// <summary>
    /// Safe last-resort line for a <see cref="ChatEventType"/> missing from BOTH the requested
    /// language and the English fallback table — a coding bug (a new event type added without a
    /// matching template entry), not a runtime condition callers can prevent. Mirrors
    /// <see cref="NotificationTemplates"/>'s <c>SafeDefault</c>.
    /// </summary>
    private const string SafeDefault = "{actorName} updated the collaboration.";

    /// <summary>
    /// Resolves the localized fallback line for a cooperation event, interpolating
    /// <paramref name="actorName"/> into the <c>{actorName}</c> placeholder.
    /// </summary>
    /// <param name="eventType">The cooperation event type.</param>
    /// <param name="language">
    /// The CLIENT participant's stored <see cref="Domain.Entities.ApplicationUser.Language"/>.
    /// Null or unrecognized falls back to <see cref="FallbackLanguage"/> ("en").
    /// </param>
    /// <param name="actorName">The event actor's display name.</param>
    public static string Resolve(ChatEventType eventType, string? language, string actorName)
    {
        var normalizedLanguage = Normalize(language);

        if (!Templates.TryGetValue(normalizedLanguage, out var languageTemplates))
            languageTemplates = Templates[FallbackLanguage];

        if (!languageTemplates.TryGetValue(eventType, out var template)
            && !Templates[FallbackLanguage].TryGetValue(eventType, out template))
        {
            template = SafeDefault;
        }

        return template.Replace("{actorName}", actorName, StringComparison.Ordinal);
    }

    private static string Normalize(string? language) =>
        language?.ToLowerInvariant() switch
        {
            "cs" => "cs",
            "de" => "de",
            "en" => "en",
            _ => FallbackLanguage,
        };
}

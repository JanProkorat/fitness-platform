using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Per-type, per-language title/body templates for <see cref="Domain.Entities.Notification"/>.
/// Mirrors the <see cref="Domain.Documents.LocalizedNames"/> pattern already used for
/// exercise/food names — a small in-code lookup table rather than a resource file, since
/// notification copy has runtime interpolation values.
///
/// Some <see cref="NotificationType"/> values cover more than one distinct wording
/// (e.g. <see cref="NotificationType.PlanPublished"/> is raised for "plan completed" AND
/// "week published", with different copy) — those pass a non-null <c>variant</c> key.
/// Every other type uses <c>variant: null</c>.
///
/// Fallback language is "en" per #788 (approved by the orchestrator): a null/unrecognized
/// stored <see cref="Domain.Entities.ApplicationUser.Language"/> resolves to English.
/// </summary>
public static class NotificationTemplates
{
    /// <summary>
    /// A resolved, but not-yet-interpolated, title/body pair for one type+variant+language.
    /// </summary>
    private sealed record Template(string Title, string Body);

    private const string FallbackLanguage = "en";

    // Variant keys — only needed for NotificationTypes with more than one distinct wording.
    public const string PlanPublishedNutritionCompleted = "nutritionCompleted";
    public const string PlanPublishedNutritionPublished = "nutritionPublished";
    public const string PlanPublishedTrainingCompleted = "trainingCompleted";
    public const string PlanPublishedTrainingPublished = "trainingPublished";
    public const string InvitationCancelledByProfessional = "cancelledByProfessional";
    public const string InvitationCancelledRevokedByClient = "revokedByClient";
    public const string InvitationCancelledAutoBySibling = "autoCancelledBySibling";
    public const string QuestionnaireAssignedRevoked = "revoked";

    // language -> "Type" or "Type:variant" -> Template
    private static readonly Dictionary<string, Dictionary<string, Template>> Templates = new()
    {
        ["en"] = new()
        {
            [Key(NotificationType.PersonalRecord)] =
                new("New Personal Record!", "{summary}"),

            [Key(NotificationType.PlanPublished, PlanPublishedNutritionCompleted)] =
                new("Nutrition plan completed", "Your nutrition plan \"{planName}\" has been marked as completed."),
            [Key(NotificationType.PlanPublished, PlanPublishedNutritionPublished)] =
                new("Nutrition plan updated", "Week {weekNumber} of your nutrition plan has been published."),
            [Key(NotificationType.PlanPublished, PlanPublishedTrainingCompleted)] =
                new("Training plan completed", "Your training plan \"{planName}\" has been marked as completed."),
            [Key(NotificationType.PlanPublished, PlanPublishedTrainingPublished)] =
                new("Training plan updated", "Week {weekNumber} of your training plan has been published."),

            [Key(NotificationType.General)] =
                new("Collaboration ended", "{clientName} ended the collaboration with you."),

            [Key(NotificationType.QuestionnaireSubmitted)] =
                new("Questionnaire submitted", "{clientName} filled in the intake questionnaire."),

            [Key(NotificationType.ClientRequestReceived)] =
                new("New client request", "{clientName} wants to work with you"),
            [Key(NotificationType.ClientRequestAccepted)] =
                new("Invitation accepted", "{clientName} accepted your invitation."),
            [Key(NotificationType.ClientRequestRejected)] =
                new("Request declined", "{profName} declined your request."),

            [Key(NotificationType.QuestionnaireAssigned)] =
                new("Questionnaire assigned", "You have been assigned a questionnaire: {questionnaireTitle}"),
            [Key(NotificationType.QuestionnaireAssigned, QuestionnaireAssignedRevoked)] =
                new("Questionnaire revoked", "{profName} has revoked your questionnaire."),

            [Key(NotificationType.InvitationReceived)] =
                new("New invitation", "{trainerName} invited you to join as their client."),
            [Key(NotificationType.InvitationAccepted)] =
                new("Invitation accepted", "{profName} accepted your invitation."),
            [Key(NotificationType.InvitationDeclined)] =
                new("Invitation declined", "{profName} declined your invitation."),

            [Key(NotificationType.InvitationCancelled, InvitationCancelledByProfessional)] =
                new("Invitation cancelled", "{trainerName} has cancelled their invitation."),
            [Key(NotificationType.InvitationCancelled, InvitationCancelledRevokedByClient)] =
                new("Invitation revoked", "{clientName} revoked their invitation."),
            [Key(NotificationType.InvitationCancelled, InvitationCancelledAutoBySibling)] =
                new("Invitation cancelled", "{clientName} accepted another {role}, so your invitation was cancelled."),

            // Not yet rewired to INotificationService.CreateAsync — WeeklyCheckInScheduler,
            // PhotoDiaryReminderScheduler, and RespondToCheckInEndpoint still construct
            // Notification entities directly (#788 follow-up). Templates exist here for
            // completeness/consistency but are unused until those call sites are migrated.
            [Key(NotificationType.WeeklyCheckInRequested)] =
                new("Planning next week", "{professionalName} is planning next week. Let them know if anything special is coming up."),
            [Key(NotificationType.WeeklyCheckInResponded)] =
                new("Client responded to check-in", "A client has responded to their weekly check-in reminder."),
            [Key(NotificationType.PhotoDiaryReminder)] =
                new("Don't forget your diary photo", "Today is day {dayIndex} of {durationDays}. Take a photo of what you eat — your nutritionist will see it live."),
        },
        ["cs"] = new()
        {
            [Key(NotificationType.PersonalRecord)] =
                new("Nový osobní rekord!", "{summary}"),

            [Key(NotificationType.PlanPublished, PlanPublishedNutritionCompleted)] =
                new("Jídelníček dokončen", "Váš jídelníček \"{planName}\" byl označen jako dokončený."),
            [Key(NotificationType.PlanPublished, PlanPublishedNutritionPublished)] =
                new("Jídelníček aktualizován", "Týden {weekNumber} vašeho jídelníčku byl zveřejněn."),
            [Key(NotificationType.PlanPublished, PlanPublishedTrainingCompleted)] =
                new("Tréninkový plán dokončen", "Váš tréninkový plán \"{planName}\" byl označen jako dokončený."),
            [Key(NotificationType.PlanPublished, PlanPublishedTrainingPublished)] =
                new("Tréninkový plán aktualizován", "Týden {weekNumber} vašeho tréninkového plánu byl zveřejněn."),

            [Key(NotificationType.General)] =
                new("Spolupráce ukončena", "{clientName} s vámi ukončil(a) spolupráci."),

            [Key(NotificationType.QuestionnaireSubmitted)] =
                new("Dotazník vyplněn", "{clientName} vyplnil(a) vstupní dotazník."),

            [Key(NotificationType.ClientRequestReceived)] =
                new("Nová žádost klienta", "{clientName} s vámi chce spolupracovat"),
            [Key(NotificationType.ClientRequestAccepted)] =
                new("Pozvánka přijata", "{clientName} přijal(a) vaši pozvánku."),
            [Key(NotificationType.ClientRequestRejected)] =
                new("Žádost zamítnuta", "{profName} zamítl(a) vaši žádost."),

            [Key(NotificationType.QuestionnaireAssigned)] =
                new("Dotazník přiřazen", "Byl vám přiřazen dotazník: {questionnaireTitle}"),
            [Key(NotificationType.QuestionnaireAssigned, QuestionnaireAssignedRevoked)] =
                new("Dotazník zrušen", "{profName} zrušil(a) váš dotazník."),

            [Key(NotificationType.InvitationReceived)] =
                new("Nová pozvánka", "{trainerName} vás pozval(a), abyste se stal(a) jeho/její klient(kou)."),
            [Key(NotificationType.InvitationAccepted)] =
                new("Pozvánka přijata", "{profName} přijal(a) vaši pozvánku."),
            [Key(NotificationType.InvitationDeclined)] =
                new("Pozvánka odmítnuta", "{profName} odmítl(a) vaši pozvánku."),

            [Key(NotificationType.InvitationCancelled, InvitationCancelledByProfessional)] =
                new("Pozvánka zrušena", "{trainerName} zrušil(a) svou pozvánku."),
            [Key(NotificationType.InvitationCancelled, InvitationCancelledRevokedByClient)] =
                new("Pozvánka odvolána", "{clientName} odvolal(a) svou pozvánku."),
            [Key(NotificationType.InvitationCancelled, InvitationCancelledAutoBySibling)] =
                new("Pozvánka zrušena", "{clientName} přijal(a) jiného/jinou {role}, takže vaše pozvánka byla zrušena."),

            [Key(NotificationType.WeeklyCheckInRequested)] =
                new("Plánování dalšího týdne", "{professionalName} plánuje další týden. Dejte mu/jí vědět, pokud se něco chystá."),
            [Key(NotificationType.WeeklyCheckInResponded)] =
                new("Klient odpověděl na check-in", "Klient odpověděl na týdenní připomenutí check-inu."),
            [Key(NotificationType.PhotoDiaryReminder)] =
                new("Nezapomeňte na fotku deníku", "Dnes je den {dayIndex} z {durationDays}. Vyfoťte si, co jíte — váš výživový poradce to uvidí živě."),
        },
        ["de"] = new()
        {
            [Key(NotificationType.PersonalRecord)] =
                new("Neuer persönlicher Rekord!", "{summary}"),

            [Key(NotificationType.PlanPublished, PlanPublishedNutritionCompleted)] =
                new("Ernährungsplan abgeschlossen", "Ihr Ernährungsplan \"{planName}\" wurde als abgeschlossen markiert."),
            [Key(NotificationType.PlanPublished, PlanPublishedNutritionPublished)] =
                new("Ernährungsplan aktualisiert", "Woche {weekNumber} Ihres Ernährungsplans wurde veröffentlicht."),
            [Key(NotificationType.PlanPublished, PlanPublishedTrainingCompleted)] =
                new("Trainingsplan abgeschlossen", "Ihr Trainingsplan \"{planName}\" wurde als abgeschlossen markiert."),
            [Key(NotificationType.PlanPublished, PlanPublishedTrainingPublished)] =
                new("Trainingsplan aktualisiert", "Woche {weekNumber} Ihres Trainingsplans wurde veröffentlicht."),

            [Key(NotificationType.General)] =
                new("Zusammenarbeit beendet", "{clientName} hat die Zusammenarbeit mit Ihnen beendet."),

            [Key(NotificationType.QuestionnaireSubmitted)] =
                new("Fragebogen ausgefüllt", "{clientName} hat den Aufnahmefragebogen ausgefüllt."),

            [Key(NotificationType.ClientRequestReceived)] =
                new("Neue Klientenanfrage", "{clientName} möchte mit Ihnen zusammenarbeiten"),
            [Key(NotificationType.ClientRequestAccepted)] =
                new("Einladung angenommen", "{clientName} hat Ihre Einladung angenommen."),
            [Key(NotificationType.ClientRequestRejected)] =
                new("Anfrage abgelehnt", "{profName} hat Ihre Anfrage abgelehnt."),

            [Key(NotificationType.QuestionnaireAssigned)] =
                new("Fragebogen zugewiesen", "Ihnen wurde ein Fragebogen zugewiesen: {questionnaireTitle}"),
            [Key(NotificationType.QuestionnaireAssigned, QuestionnaireAssignedRevoked)] =
                new("Fragebogen storniert", "{profName} hat Ihren Fragebogen storniert."),

            [Key(NotificationType.InvitationReceived)] =
                new("Neue Einladung", "{trainerName} hat Sie eingeladen, sein/ihr Klient zu werden."),
            [Key(NotificationType.InvitationAccepted)] =
                new("Einladung angenommen", "{profName} hat Ihre Einladung angenommen."),
            [Key(NotificationType.InvitationDeclined)] =
                new("Einladung abgelehnt", "{profName} hat Ihre Einladung abgelehnt."),

            [Key(NotificationType.InvitationCancelled, InvitationCancelledByProfessional)] =
                new("Einladung storniert", "{trainerName} hat seine/ihre Einladung storniert."),
            [Key(NotificationType.InvitationCancelled, InvitationCancelledRevokedByClient)] =
                new("Einladung zurückgezogen", "{clientName} hat die Einladung zurückgezogen."),
            [Key(NotificationType.InvitationCancelled, InvitationCancelledAutoBySibling)] =
                new("Einladung storniert", "{clientName} hat eine andere {role} angenommen, daher wurde Ihre Einladung storniert."),

            [Key(NotificationType.WeeklyCheckInRequested)] =
                new("Planung der nächsten Woche", "{professionalName} plant die nächste Woche. Sagen Sie ihm/ihr Bescheid, falls etwas Besonderes ansteht."),
            [Key(NotificationType.WeeklyCheckInResponded)] =
                new("Klient hat auf Check-in geantwortet", "Ein Klient hat auf die wöchentliche Check-in-Erinnerung geantwortet."),
            [Key(NotificationType.PhotoDiaryReminder)] =
                new("Vergessen Sie Ihr Tagebuchfoto nicht", "Heute ist Tag {dayIndex} von {durationDays}. Machen Sie ein Foto von dem, was Sie essen — Ihr Ernährungsberater sieht es live."),
        },
    };

    /// <summary>
    /// Resolves the localized title/body for a notification, interpolating
    /// <paramref name="parameters"/> values into <c>{key}</c> placeholders.
    /// </summary>
    /// <param name="type">The notification type.</param>
    /// <param name="language">
    /// The recipient's stored <see cref="Domain.Entities.ApplicationUser.Language"/>.
    /// Null or unrecognized falls back to <see cref="FallbackLanguage"/> ("en", #788).
    /// </param>
    /// <param name="parameters">Interpolation values, keyed by placeholder name (no braces).</param>
    /// <param name="variant">
    /// Distinguishes multiple wordings under the same <paramref name="type"/> — see the
    /// <c>*Variant</c>/named constants on this class. Null for types with a single wording.
    /// </param>
    public static (string Title, string Body) Resolve(
        NotificationType type,
        string? language,
        IReadOnlyDictionary<string, string>? parameters = null,
        string? variant = null)
    {
        var normalizedLanguage = Normalize(language);
        var key = Key(type, variant);

        var template = Templates[normalizedLanguage].TryGetValue(key, out var found)
            ? found
            : Templates[FallbackLanguage][key]; // defensive — every language table is fully populated above

        return (Interpolate(template.Title, parameters), Interpolate(template.Body, parameters));
    }

    private static string Key(NotificationType type, string? variant = null) =>
        variant is null ? type.ToString() : $"{type}:{variant}";

    private static string Normalize(string? language) =>
        language?.ToLowerInvariant() switch
        {
            "cs" => "cs",
            "de" => "de",
            "en" => "en",
            _ => FallbackLanguage,
        };

    private static string Interpolate(string template, IReadOnlyDictionary<string, string>? parameters)
    {
        if (parameters is null || parameters.Count == 0) return template;

        var result = template;
        foreach (var (paramKey, value) in parameters)
        {
            result = result.Replace("{" + paramKey + "}", value, StringComparison.Ordinal);
        }
        return result;
    }
}

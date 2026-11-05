using FormUp.Application.Domain.Enums;

namespace FormUp.Application.Domain.Interfaces;

/// <summary>
/// Background work item for a coach notification email (check-in, join request, photos, workout, new messages).
/// Carries values only: the worker renders and sends it in a fresh scope.
/// </summary>
/// <param name="Email">Recipient email address. Never logged; log <paramref name="UserId"/> instead.</param>
/// <param name="Language">Two-letter language code (en, cs, de) from the recipient's profile.</param>
/// <param name="UserId">The recipient's user id, the only identifier safe to log.</param>
/// <param name="Event">The notification event that selects the template.</param>
/// <param name="Values">Plain-text template values by key; see the <c>*Key</c> constants.</param>
public sealed record NotificationEmailWorkItem(
    string Email,
    string Language,
    Guid UserId,
    NotificationEvent Event,
    IReadOnlyDictionary<string, string> Values)
    : EmailDispatchWorkItem(Email, Language)
{
    /// <summary>Full name of the client the event is about.</summary>
    public const string ClientNameKey = "ClientName";

    /// <summary>Public id of the client's profile, used to build the portal link. Input to the sender only.</summary>
    public const string ClientPublicIdKey = "ClientPublicId";

    /// <summary>Absolute portal link behind the email's button.</summary>
    public const string ActionUrlKey = "ActionUrl";

    /// <summary>Check-in: the weight answer, already formatted with its unit. Optional.</summary>
    public const string WeightKey = "Weight";

    /// <summary>Join request: the client's message. Optional.</summary>
    public const string MessageKey = "Message";

    /// <summary>Join request: the package the client attached. Optional.</summary>
    public const string PackageNameKey = "PackageName";

    /// <summary>Photos: how many photos were submitted.</summary>
    public const string PhotoCountKey = "PhotoCount";

    /// <summary>Photos: the date of the coach's request as <c>yyyy-MM-dd</c>; the renderer localizes it. Optional.</summary>
    public const string RequestDateKey = "RequestDate";

    /// <summary>Workout: the session name. Optional.</summary>
    public const string SessionNameKey = "SessionName";

    /// <summary>Workout: the plan name. Optional.</summary>
    public const string PlanNameKey = "PlanName";

    /// <summary>Workout: duration in whole minutes. Optional.</summary>
    public const string DurationMinutesKey = "DurationMinutes";

    /// <summary>Workout: number of logged exercises.</summary>
    public const string ExerciseCountKey = "ExerciseCount";

    /// <summary>Workout: number of logged sets.</summary>
    public const string SetCountKey = "SetCount";

    /// <summary>Workout: the client's note. Optional.</summary>
    public const string NoteKey = "Note";

    /// <summary>New message: how many unread messages the burst holds. The email never carries message text.</summary>
    public const string MessageCountKey = "MessageCount";
}

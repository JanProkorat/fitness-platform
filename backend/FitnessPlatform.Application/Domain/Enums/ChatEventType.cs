namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// The kind of professional-client cooperation event a
/// <see cref="Entities.ChatMessage"/> with <see cref="ChatMessageKind.Event"/>
/// represents. The actor is the row's <c>SenderUserId</c> — no separate
/// actor-name payload is stored.
/// </summary>
public enum ChatEventType
{
    /// <summary>A professional invited the client to collaborate.</summary>
    Invited = 0,

    /// <summary>A client requested to collaborate with the professional.</summary>
    Requested = 1,

    /// <summary>An invite or request was accepted.</summary>
    Accepted = 2,

    /// <summary>An invite or request was declined.</summary>
    Declined = 3,

    /// <summary>An invite or request was withdrawn by its author.</summary>
    Withdrawn = 4
}

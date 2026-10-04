namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Discriminates a <see cref="Entities.ChatMessage"/> row between free-form
/// text authored by a participant and a system-generated cooperation event
/// (invite sent, request accepted, etc.) rendered inline in the same thread.
/// </summary>
public enum ChatMessageKind
{
    /// <summary>A plain message authored by one of the two participants.</summary>
    Text = 0,

    /// <summary>A system-generated cooperation event — see <see cref="ChatEventType"/>.</summary>
    Event = 1
}

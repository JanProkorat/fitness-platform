using FastEndpoints;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Messaging.GetConversations;

/// <summary>
/// Request model for listing the authenticated user's conversations.
/// </summary>
public class GetConversationsRequest
{
    /// <summary>Whether to return the archived view instead of the active one.</summary>
    [QueryParam]
    public bool Archived { get; set; } = false;

    /// <summary>
    /// Optional filter chip narrowing the professional caller's roster the same way the
    /// trainer's clients list does. Omitted or <see cref="ClientListFilter.All"/> returns every
    /// conversation, matching this endpoint's pre-existing behaviour. Not valid for a client
    /// caller — see <see cref="GetConversationsEndpoint"/>.
    /// </summary>
    [QueryParam]
    public ClientListFilter? Filter { get; set; }
}

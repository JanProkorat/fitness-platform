namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Derived status of a client on the trainer's clients list. Never stored — computed per request
/// from the link's <c>IsActive</c> flag plus whether an in-window Active plan exists in a domain
/// the link grants (see <c>GetClientsEndpoint</c>).
/// </summary>
public enum ClientListStatus
{
    /// <summary>Live link, and at least one visible domain has an in-window Active plan.</summary>
    Active,

    /// <summary>Live link, but no visible domain has an in-window Active plan.</summary>
    Paused,

    /// <summary>The link has ended (<c>IsActive == false</c>).</summary>
    Archived
}

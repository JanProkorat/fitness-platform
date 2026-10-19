using FitnessPlatform.Application.Domain.Entities;

namespace FitnessPlatform.Application.Features.Automations.Shared;

/// <summary>
/// What a per-client automation endpoint needs once the caller's access to the client is proven.
/// </summary>
/// <param name="Profile">The caller's professional profile.</param>
/// <param name="Client">The client profile, with its user loaded.</param>
/// <param name="StartedAt">When the caller's earliest live link to the client began (UTC).</param>
/// <param name="TagIds">Ids of the caller's tags assigned to the client across the caller's live links.</param>
public sealed record AutomationClientContext(
    ProfessionalProfile Profile,
    ClientProfile Client,
    DateTime StartedAt,
    IReadOnlyList<long> TagIds);

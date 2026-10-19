using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Automations.Shared;

/// <summary>
/// A request audience after ownership checks: the audience kind plus the internal ids it resolves to.
/// </summary>
/// <param name="Audience">The audience kind.</param>
/// <param name="TagId">Internal id of the owned tag for a Tag audience.</param>
/// <param name="ClientProfileIds">Internal ids of the linked clients for a Chosen audience.</param>
public readonly record struct ResolvedAutomationAudience(
    AutomationAudience Audience,
    long? TagId,
    IReadOnlyList<long> ClientProfileIds);

using FormUp.Application.Domain.Entities;

namespace FormUp.Application.Domain.Services;

/// <summary>
/// One rule as one client experiences it, with the client facts the worker computes it from.
/// </summary>
/// <param name="Rule">The rule, with its audience clients loaded.</param>
/// <param name="Client">The covered client the rule applies to.</param>
/// <param name="Effective">The rule with the client's override and pause applied.</param>
/// <param name="Zone">The client's time zone.</param>
/// <param name="StartLocalDate">The client's schedule start date in their local calendar.</param>
/// <param name="FirstSendNotBeforeUtc">The moment a weekly check-in may not start before; see <see cref="AutomationNextSendCalculator.ResolveFirstSendNotBefore"/>.</param>
public sealed record AutomationPair(
    AutomationRule Rule,
    AutomationCoveredClient Client,
    AutomationEffectiveRule Effective,
    TimeZoneInfo Zone,
    DateOnly StartLocalDate,
    DateTime FirstSendNotBeforeUtc);

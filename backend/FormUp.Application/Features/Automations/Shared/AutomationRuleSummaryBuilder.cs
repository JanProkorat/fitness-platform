using FormUp.Application.Domain.Entities;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Domain.Services;
using FormUp.Application.Infrastructure.Data;
using FormUp.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;

namespace FormUp.Application.Features.Automations.Shared;

/// <summary>
/// Builds the coverage summary of rules from the coach's covered clients.
/// </summary>
public static class AutomationRuleSummaryBuilder
{
    /// <summary>
    /// Summarises each rule across the covered clients it applies to: client count, custom and paused
    /// counts, and the earliest next send. Rules must be loaded with their audience clients.
    /// </summary>
    /// <param name="db">Application database context.</param>
    /// <param name="mongo">MongoDB context; read only when a plan-event rule is in play.</param>
    /// <param name="coachUserId">The coach's user id.</param>
    /// <param name="rules">The rules to summarise.</param>
    /// <param name="covered">The coach's covered clients.</param>
    /// <param name="nowUtc">The current instant.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Summaries keyed by the rule's internal id.</returns>
    public static async Task<Dictionary<long, AutomationRuleSummaryDto>> BuildSummariesAsync(
        IApplicationDbContext db,
        IMongoContext mongo,
        Guid coachUserId,
        IReadOnlyList<AutomationRule> rules,
        IReadOnlyList<AutomationCoveredClient> covered,
        DateTime nowUtc,
        CancellationToken ct)
    {
        var summaries = rules.ToDictionary(r => r.Id, _ => new AutomationRuleSummaryDto());

        if (rules.Count == 0 || covered.Count == 0)
        {
            return summaries;
        }

        var ruleIds = rules.Select(r => r.Id).ToList();
        var coveredIds = covered.Select(c => c.ClientProfileId).ToList();

        var overrides = (await db.AutomationClientOverrides
                .AsNoTracking()
                .Where(o => ruleIds.Contains(o.AutomationRuleId) && coveredIds.Contains(o.ClientProfileId))
                .ToListAsync(ct))
            .ToDictionary(o => (o.AutomationRuleId, o.ClientProfileId));

        var contexts = covered.ToDictionary(c => c.ClientProfileId, c =>
        {
            var zone = ClientLocalDateResolver.ResolveTimeZone(c.TimeZoneId);
            return new ClientContext(
                c,
                zone,
                ClientLocalDateResolver.ResolveLocalDate(nowUtc, zone),
                AutomationNextSendCalculator.ResolveStartLocalDate(c.LinkedSince, zone));
        });

        var pairs = new List<RulePair>();

        foreach (var rule in rules)
        {
            foreach (var client in covered)
            {
                if (!AutomationAudienceFilter.Covers(rule, client.ClientProfileId, client.TagIds))
                {
                    continue;
                }

                overrides.TryGetValue((rule.Id, client.ClientProfileId), out var clientOverride);
                var context = contexts[client.ClientProfileId];

                pairs.Add(new RulePair(
                    rule,
                    context,
                    clientOverride,
                    AutomationEffectiveRule.Resolve(rule, clientOverride, context.LocalToday)));
            }
        }

        var planWindows = await LoadPlanWindowsAsync(mongo, coachUserId, pairs, ct);

        foreach (var pair in pairs)
        {
            var summary = summaries[pair.Rule.Id];
            summary.ClientCount++;

            if (pair.Override is { IsCustomized: true })
            {
                summary.CustomCount++;
            }

            if (pair.Effective.IsPaused)
            {
                summary.PausedCount++;
            }

            var windows = planWindows.TryGetValue(pair.Context.Client.ClientUserId, out var found) ? found : [];
            var nextSendAt = AutomationNextSendCalculator.Compute(
                pair.Effective,
                pair.Context.Zone,
                pair.Context.StartLocalDate,
                windows,
                nowUtc,
                AutomationNextSendCalculator.ResolveFirstSendNotBefore(
                    pair.Context.Client.CollaborationStartedAtUtc, pair.Rule, pair.Override));

            if (nextSendAt is not null && (summary.NextSendAt is null || nextSendAt < summary.NextSendAt))
            {
                summary.NextSendAt = nextSendAt;
            }
        }

        return summaries;
    }

    private static async Task<Dictionary<Guid, List<AutomationPlanWindow>>> LoadPlanWindowsAsync(
        IMongoContext mongo, Guid coachUserId, List<RulePair> pairs, CancellationToken ct)
    {
        var planEventClients = pairs
            .Where(p => p.Effective.IsPlanEvent)
            .Select(p => p.Context.Client)
            .DistinctBy(c => c.ClientProfileId)
            .ToList();

        if (planEventClients.Count == 0)
        {
            return [];
        }

        return await AutomationPlanWindowLoader.LoadAsync(
            mongo,
            coachUserId,
            planEventClients.Where(c => c.CanViewTrainingPlans).Select(c => c.ClientUserId).ToList(),
            planEventClients.Where(c => c.CanViewNutritionPlans).Select(c => c.ClientUserId).ToList(),
            ct);
    }

    private sealed record ClientContext(
        AutomationCoveredClient Client,
        TimeZoneInfo Zone,
        DateOnly LocalToday,
        DateOnly StartLocalDate);

    private sealed record RulePair(
        AutomationRule Rule,
        ClientContext Context,
        AutomationClientOverride? Override,
        AutomationEffectiveRule Effective);
}

using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Keeps the <see cref="AutomationSchedule"/> rows of one coach in step with their rules: one row per
/// (rule, client) for schedule and plan-event rules, its next run computed by the same calculator
/// the client tab shows, so the stored and the displayed next send cannot differ.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="logger">Logger.</param>
public sealed class AutomationReconciler(IApplicationDbContext db, ILogger<AutomationReconciler> logger)
{
    /// <summary>
    /// Creates, updates and removes the coach's schedule rows. A row that is already due is left alone
    /// for the claim to run, and a new row only ever gets a date after <paramref name="nowUtc"/>.
    /// </summary>
    /// <param name="snapshot">The coach's rules, clients and plan windows.</param>
    /// <param name="nowUtc">The current instant.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task ReconcileAsync(AutomationCoachSnapshot snapshot, DateTime nowUtc, CancellationToken ct)
    {
        var ruleIds = snapshot.Rules.Select(r => r.Id).ToList();

        var existing = await db.AutomationSchedules
            .Where(s => ruleIds.Contains(s.AutomationRuleId))
            .ToDictionaryAsync(s => (s.AutomationRuleId, s.ClientProfileId), ct);

        var wanted = new HashSet<(long RuleId, long ClientId)>();

        foreach (var pair in snapshot.Pairs(nowUtc))
        {
            var effective = pair.Effective;

            if (effective.TriggerKind != AutomationTriggerKind.Schedule && !effective.IsPlanEvent)
            {
                continue;
            }

            var key = (pair.Rule.Id, pair.Client.ClientProfileId);
            wanted.Add(key);
            existing.TryGetValue(key, out var row);

            if (row?.NextRunAt is { } stored && stored <= nowUtc)
            {
                continue;
            }

            var next = AutomationNextSendCalculator.Compute(
                effective,
                pair.Zone,
                pair.StartLocalDate,
                effective.IsPlanEvent ? snapshot.PlanWindows(pair.Client.ClientUserId) : [],
                nowUtc);

            if (next is not null
                && effective.StopAfterSends is { } limit
                && snapshot.SentCount(pair.Rule.Id, pair.Client.ClientProfileId) >= limit)
            {
                next = null;
            }

            var localTime = effective.LocalTime ?? AutomationPlanEventCalculator.DefaultLocalTime;

            if (row is null)
            {
                if (next is not null)
                {
                    db.AutomationSchedules.Add(new AutomationSchedule
                    {
                        AutomationRuleId = pair.Rule.Id,
                        ClientProfileId = pair.Client.ClientProfileId,
                        NextRunAt = next,
                        LocalTime = localTime,
                        TimeZoneId = pair.Zone.Id,
                    });
                }

                continue;
            }

            row.NextRunAt = next;
            row.LocalTime = localTime;
            row.TimeZoneId = pair.Zone.Id;
        }

        foreach (var (key, row) in existing)
        {
            var isDue = row.NextRunAt is { } stored && stored <= nowUtc;

            if (!wanted.Contains(key) && !isDue)
            {
                db.AutomationSchedules.Remove(row);
            }
        }

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex is DbUpdateConcurrencyException || AutomationDbErrors.IsUniqueViolation(ex))
        {
            logger.LogDebug(ex,
                "AutomationScheduler: another worker reconciled coach {CoachProfileId} at the same time; the next tick settles it.",
                snapshot.Coach.Id);
        }
    }
}

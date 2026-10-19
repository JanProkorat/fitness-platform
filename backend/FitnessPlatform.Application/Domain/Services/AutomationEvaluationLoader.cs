using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Loads an <see cref="AutomationEvaluation"/> for one rule and client, applying the same
/// coverage, role and audience checks every time.
/// </summary>
public static class AutomationEvaluationLoader
{
    /// <summary>
    /// Loads the evaluation, or null when the rule is gone or the client is not reachable any more:
    /// no live link that grants access, the coach role of every such link removed, or an audience
    /// that no longer includes the client.
    /// </summary>
    /// <param name="db">Application database context.</param>
    /// <param name="ruleId">Internal id of the rule.</param>
    /// <param name="clientProfileId">Internal id of the client profile.</param>
    /// <param name="nowUtc">The current instant, which decides whether a pause lapsed.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<AutomationEvaluation?> LoadAsync(
        IApplicationDbContext db, long ruleId, long clientProfileId, DateTime nowUtc, CancellationToken ct)
    {
        var rule = await db.AutomationRules
            .AsNoTracking()
            .Include(r => r.Questionnaire)
            .Include(r => r.AudienceClients)
            .FirstOrDefaultAsync(r => r.Id == ruleId, ct);

        if (rule is null)
        {
            return null;
        }

        var coach = await db.ProfessionalProfiles
            .AsNoTracking()
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.Id == rule.OwnerProfessionalProfileId, ct);

        if (coach is null)
        {
            return null;
        }

        var client = (await AutomationCoverage.LoadCoveredClientsAsync(
            db, coach.Id, ct, excludeRemovedRoles: true, onlyClientProfileId: clientProfileId)).FirstOrDefault();

        if (client is null || !AutomationAudienceFilter.Covers(rule, clientProfileId, client.TagIds))
        {
            return null;
        }

        var clientOverride = await db.AutomationClientOverrides
            .AsNoTracking()
            .FirstOrDefaultAsync(o => o.AutomationRuleId == ruleId && o.ClientProfileId == clientProfileId, ct);

        var zone = ClientLocalDateResolver.ResolveTimeZone(client.TimeZoneId);
        var localToday = ClientLocalDateResolver.ResolveLocalDate(nowUtc, zone);

        return new AutomationEvaluation
        {
            Rule = rule,
            Coach = coach,
            Client = client,
            Effective = AutomationEffectiveRule.Resolve(rule, clientOverride, localToday),
            Zone = zone,
            StartLocalDate = AutomationNextSendCalculator.ResolveStartLocalDate(client.LinkedSince, zone),
        };
    }

    /// <summary>
    /// Loads the coach's plan windows for one client, reading only the domains the client's live link grants.
    /// </summary>
    /// <param name="mongo">MongoDB context.</param>
    /// <param name="evaluation">The evaluation of the rule and client.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<List<AutomationPlanWindow>> LoadPlanWindowsAsync(
        IMongoContext mongo, AutomationEvaluation evaluation, CancellationToken ct)
    {
        var clientUserIds = new List<Guid> { evaluation.Client.ClientUserId };

        var windows = await AutomationPlanWindowLoader.LoadAsync(
            mongo,
            evaluation.Coach.UserId,
            evaluation.Client.CanViewTrainingPlans ? clientUserIds : [],
            evaluation.Client.CanViewNutritionPlans ? clientUserIds : [],
            ct);

        return windows.TryGetValue(evaluation.Client.ClientUserId, out var forClient) ? forClient : [];
    }
}

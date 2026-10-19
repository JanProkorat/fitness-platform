using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Automations.Shared;

/// <summary>
/// Load-and-authorize sequences for the per-client automation endpoints.
/// </summary>
public static class AutomationClientGuards
{
    /// <summary>
    /// Proves the caller has a live link to the client and loads what the endpoints need. No live link
    /// answers 404; a live link that grants nothing answers 403.
    /// </summary>
    public static async Task<AutomationClientContext?> LoadClientContextOrRespondAsync(
        this IEndpoint endpoint,
        IApplicationDbContext db,
        IClientLinkAuthorizationService linkAuthorizationService,
        Guid userId,
        Guid clientPublicId,
        CancellationToken ct)
    {
        var capabilities = await linkAuthorizationService.GetCapabilitiesByClientPublicIdAsync(userId, clientPublicId, ct);

        if (capabilities is null)
        {
            await endpoint.HttpContext.Response.SendNotFoundAsync(ct);
            return null;
        }

        if (capabilities.Value.GrantsNothing)
        {
            await endpoint.HttpContext.Response.SendForbiddenAsync(ct);
            return null;
        }

        var profile = await endpoint.LoadCallerProfileOrRespondAsync(db, userId, ct);

        if (profile is null)
        {
            return null;
        }

        var client = await db.ClientProfiles
            .AsNoTracking()
            .Include(c => c.User)
            .FirstOrDefaultAsync(c => c.PublicId == clientPublicId, ct);

        if (client is null)
        {
            await endpoint.HttpContext.Response.SendNotFoundAsync(ct);
            return null;
        }

        var links = await db.ClientProfessionalLinks
            .AsNoTracking()
            .Where(l => l.ProfessionalProfileId == profile.Id && l.ClientProfileId == client.Id && l.IsActive)
            .Select(l => new { l.Id, l.DateCreated })
            .ToListAsync(ct);

        if (links.Count == 0)
        {
            await endpoint.HttpContext.Response.SendNotFoundAsync(ct);
            return null;
        }

        var linkIds = links.Select(l => l.Id).ToList();

        var tagIds = await db.ClientTagAssignments
            .AsNoTracking()
            .Where(a => linkIds.Contains(a.ClientProfessionalLinkId))
            .Select(a => a.ClientTagId)
            .Distinct()
            .ToListAsync(ct);

        return new AutomationClientContext(profile, client, links.Min(l => l.DateCreated), tagIds);
    }

    /// <summary>
    /// Loads a rule that covers the client (global rule whose audience includes them, or their own
    /// client-only rule), or answers a coded 404. Another client's client-only rule is a 404.
    /// </summary>
    public static async Task<AutomationRule?> LoadCoveringRuleOrRespondAsync(
        this IEndpoint endpoint,
        IApplicationDbContext db,
        AutomationClientContext context,
        Guid ruleId,
        CancellationToken ct)
    {
        var rule = await db.AutomationRules
            .AsNoTracking()
            .CoveringClient(context.Profile.Id, context.Client.Id, context.TagIds)
            .FirstOrDefaultAsync(r => r.PublicId == ruleId, ct);

        if (rule is null)
        {
            await endpoint.SendProblemAsync(
                StatusCodes.Status404NotFound,
                ErrorCodes.AutomationRuleNotFound,
                "Automation rule not found.",
                ct);
        }

        return rule;
    }

    /// <summary>Answers 409 for a client-only rule on the override routes; returns true when it did.</summary>
    public static async Task<bool> RespondIfClientOnlyAsync(
        this IEndpoint endpoint, AutomationRule rule, CancellationToken ct)
    {
        if (rule.ClientProfileId is null)
        {
            return false;
        }

        await endpoint.SendProblemAsync(
            StatusCodes.Status409Conflict,
            ErrorCodes.AutomationClientOnlyRuleNotOverridable,
            "A client-only rule is changed through the rule itself.",
            ct);
        return true;
    }
}

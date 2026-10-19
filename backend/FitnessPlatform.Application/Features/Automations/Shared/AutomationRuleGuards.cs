using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Automations.Shared;

/// <summary>
/// Load-and-authorize sequences shared by the automation endpoints. Each returns null (or a failed
/// result) after writing the response, so the caller only has to return.
/// </summary>
public static class AutomationRuleGuards
{
    /// <summary>Loads the caller's professional profile, or answers 404.</summary>
    public static async Task<ProfessionalProfile?> LoadCallerProfileOrRespondAsync(
        this IEndpoint endpoint, IApplicationDbContext db, Guid userId, CancellationToken ct)
    {
        var profile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == userId, ct);

        if (profile is null)
        {
            await endpoint.HttpContext.Response.SendNotFoundAsync(ct);
        }

        return profile;
    }

    /// <summary>
    /// For a SendForm rule, resolves the questionnaire the caller owns; answers a coded 404 when it is
    /// not the caller's. Other actions resolve to a null id.
    /// </summary>
    public static async Task<(bool Ok, long? QuestionnaireId)> ResolveQuestionnaireOrRespondAsync(
        this IEndpoint endpoint, IApplicationDbContext db, Guid userId, AutomationRuleBody body, CancellationToken ct)
    {
        if (body.ActionType != AutomationActionType.SendForm)
        {
            return (true, null);
        }

        var questionnaire = await db.Questionnaires
            .AsNoTracking()
            .Where(q => q.PublicId == body.QuestionnaireId && q.ProfessionalId == userId)
            .Select(q => new { q.Id, q.IsActive, q.Type })
            .FirstOrDefaultAsync(ct);

        if (questionnaire is null)
        {
            await endpoint.SendProblemAsync(
                StatusCodes.Status404NotFound,
                ErrorCodes.AutomationQuestionnaireNotFound,
                "Questionnaire not found.",
                ct);
            return (false, null);
        }

        if (!AutomationQuestionnaireUsability.IsUsable(questionnaire.IsActive, questionnaire.Type))
        {
            await endpoint.SendProblemAsync(
                StatusCodes.Status400BadRequest,
                ErrorCodes.AutomationQuestionnaireNotUsable,
                "The questionnaire is inactive or a check-in form and cannot be sent by a rule.",
                ct);
            return (false, null);
        }

        return (true, questionnaire.Id);
    }

    /// <summary>
    /// Resolves a request audience: a Tag audience needs a tag owned by the caller's profile, a Chosen
    /// audience needs every client to have a live link to the caller. Any miss rejects the whole request.
    /// </summary>
    public static async Task<ResolvedAutomationAudience?> ResolveAudienceOrRespondAsync(
        this IEndpoint endpoint,
        IApplicationDbContext db,
        ProfessionalProfile profile,
        AutomationAudienceBody body,
        AutomationAudience audience,
        CancellationToken ct)
    {
        if (audience == AutomationAudience.Tag)
        {
            var tagId = await db.ClientTags
                .AsNoTracking()
                .Where(t => t.PublicId == body.AudienceTagId && t.OwnerProfessionalProfileId == profile.Id)
                .Select(t => (long?)t.Id)
                .FirstOrDefaultAsync(ct);

            if (tagId is null)
            {
                await endpoint.SendProblemAsync(
                    StatusCodes.Status404NotFound,
                    ErrorCodes.AutomationTagNotFound,
                    "Tag not found.",
                    ct);
                return null;
            }

            return new ResolvedAutomationAudience(audience, tagId, []);
        }

        if (audience == AutomationAudience.Chosen)
        {
            var publicIds = body.AudienceClientIds.Distinct().ToList();

            var clientProfileIds = await db.ClientProfessionalLinks
                .AsNoTracking()
                .Where(l => l.ProfessionalProfileId == profile.Id && l.IsActive && publicIds.Contains(l.ClientProfile.PublicId))
                .Select(l => l.ClientProfileId)
                .Distinct()
                .ToListAsync(ct);

            if (clientProfileIds.Count != publicIds.Count)
            {
                await endpoint.SendProblemAsync(
                    StatusCodes.Status404NotFound,
                    ErrorCodes.AutomationAudienceClientNotFound,
                    "One or more clients were not found.",
                    ct);
                return null;
            }

            return new ResolvedAutomationAudience(audience, null, clientProfileIds);
        }

        return new ResolvedAutomationAudience(audience, null, []);
    }

    /// <summary>
    /// Loads (tracked, with detail navigations) a rule owned by the caller's profile, or answers a coded 404.
    /// </summary>
    public static async Task<AutomationRule?> LoadOwnedRuleOrRespondAsync(
        this IEndpoint endpoint, IApplicationDbContext db, long profileId, Guid ruleId, bool track, CancellationToken ct)
    {
        var query = db.AutomationRules.Where(r => r.PublicId == ruleId && r.OwnerProfessionalProfileId == profileId).WithDetails();

        if (!track)
        {
            query = query.AsNoTracking();
        }

        var rule = await query.FirstOrDefaultAsync(ct);

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
}

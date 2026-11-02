using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Authorization;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.Automations.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Automations.UpdateAutomationRule;

/// <summary>
/// Replaces one of the caller's automation rules (global or client-only).
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="entitlementService">Resolves the coach's subscription entitlements.</param>
[RemovedCoachRole(RemovedCoachRoleMode.Refuse)]
public class UpdateAutomationRuleEndpoint(IApplicationDbContext db, EntitlementService entitlementService)
    : Endpoint<UpdateAutomationRuleRequest, AutomationRuleDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/trainer/automations/rules/{RuleId}");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Update an automation rule";
            s.Description =
                "Replaces the rule. A missing audience leaves a global rule's audience unchanged; a client-only rule takes none.";
            s.Responses[StatusCodes.Status200OK] = "The updated rule";
            s.Responses[StatusCodes.Status400BadRequest] =
                "Invalid rule, an audience sent for a client-only rule, the questionnaire is inactive, or the check-in fields do not match the form";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status403Forbidden] = "The rule would be an enabled check-in rule and the subscription does not include weekly check-ins";
            s.Responses[StatusCodes.Status404NotFound] =
                "Rule not found or owned by another coach, or the questionnaire, tag or a chosen client was not found";
            s.Responses[StatusCodes.Status409Conflict] =
                "The request changes the rule's action type, which is locked after creation, or the coach already has another enabled check-in rule";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateAutomationRuleRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var profile = await this.LoadCallerProfileOrRespondAsync(db, Guid.Parse(userId), ct);

        if (profile is null)
        {
            return;
        }

        var rule = await this.LoadOwnedRuleOrRespondAsync(db, profile.Id, req.RuleId, track: true, ct);

        if (rule is null)
        {
            return;
        }

        if (rule.ActionType != req.ActionType)
        {
            await this.SendProblemAsync(
                StatusCodes.Status409Conflict,
                ErrorCodes.AutomationActionTypeLocked,
                "A rule's action cannot change after it is created.",
                ct);
            return;
        }

        if (rule.ClientProfileId is not null && req.Audience is not null)
        {
            this.ThrowErrorWithCode(
                ErrorCodes.AutomationAudienceNotAllowedOnClientOnlyRule,
                "A client-only rule has no audience.");
        }

        var (questionnaireOk, questionnaireId, isCheckIn) =
            await this.ResolveQuestionnaireOrRespondAsync(db, Guid.Parse(userId), req, ct);

        if (!questionnaireOk)
        {
            return;
        }

        // Switching a check-in rule off stays allowed for a downgraded coach; any enabled one needs the feature.
        if (isCheckIn && req.Enabled && await this.RespondIfCheckInNotEntitledAsync(entitlementService, profile.Id, false, ct))
        {
            return;
        }

        ResolvedAutomationAudience? audience = null;

        if (req.Audience is not null)
        {
            audience = await this.ResolveAudienceOrRespondAsync(db, profile, req, req.Audience.Value, ct);

            if (audience is null)
            {
                return;
            }
        }

        rule.Name = req.Name.Trim();
        rule.QuestionnaireId = questionnaireId;
        AutomationRuleWriter.Apply(rule, req, isCheckIn);

        if (audience is not null)
        {
            ApplyAudience(rule, audience.Value);
        }

        await using var transaction = await db.BeginTransactionAsync(ct);

        // Enabling a check-in rule, or pointing a rule at a check-in form, must not make a second one.
        if (isCheckIn && rule.Enabled)
        {
            await db.LockProfessionalProfileAsync(profile.Id, ct);

            if (await this.RespondIfCheckInRuleExistsAsync(db, profile.Id, rule.Id, ct))
            {
                return;
            }
        }

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        var saved = await db.AutomationRules
            .AsNoTracking()
            .Where(r => r.Id == rule.Id)
            .WithDetails()
            .FirstAsync(ct);

        await Send.OkAsync(AutomationRuleDto.FromEntity(saved), ct);
    }

    private static void ApplyAudience(AutomationRule rule, ResolvedAutomationAudience audience)
    {
        rule.Audience = audience.Audience;
        rule.AudienceTagId = audience.TagId;

        // Diff instead of clear-and-add: a delete and re-insert of the same (rule, client) pair in one
        // save would collide on the unique index.
        var desired = audience.ClientProfileIds.ToHashSet();

        foreach (var stale in rule.AudienceClients.Where(a => !desired.Contains(a.ClientProfileId)).ToList())
        {
            rule.AudienceClients.Remove(stale);
        }

        var existing = rule.AudienceClients.Select(a => a.ClientProfileId).ToHashSet();

        foreach (var clientProfileId in desired.Where(id => !existing.Contains(id)))
        {
            rule.AudienceClients.Add(new AutomationRuleAudienceClient { ClientProfileId = clientProfileId });
        }
    }
}

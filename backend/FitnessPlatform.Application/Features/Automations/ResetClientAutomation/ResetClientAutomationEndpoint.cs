using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Authorization;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Automations.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Automations.ResetClientAutomation;

/// <summary>
/// Removes a client's override and pause so the global rule applies unchanged again.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="linkAuthorizationService">Resolves link capabilities.</param>
[RemovedCoachRole(RemovedCoachRoleMode.Refuse)]
public class ResetClientAutomationEndpoint(IApplicationDbContext db, IClientLinkAuthorizationService linkAuthorizationService)
    : Endpoint<ResetClientAutomationRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/trainer/clients/{ClientId}/automations/{RuleId}/override");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Reset a rule to its default for one client";
            s.Description = "Deletes the client's customisation and pause of the rule.";
            s.Responses[StatusCodes.Status204NoContent] = "Rule reset";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status403Forbidden] = "The live link grants no access";
            s.Responses[StatusCodes.Status404NotFound] = "No live link to the client, or the rule does not apply to them";
            s.Responses[StatusCodes.Status409Conflict] = "The rule has no override for this client, or it is a client-only rule";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(ResetClientAutomationRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var context = await this.LoadClientContextOrRespondAsync(
            db, linkAuthorizationService, Guid.Parse(userId), req.ClientId, ct);

        if (context is null)
        {
            return;
        }

        var rule = await this.LoadCoveringRuleOrRespondAsync(db, context, req.RuleId, ct);

        if (rule is null || await this.RespondIfClientOnlyAsync(rule, ct))
        {
            return;
        }

        var clientOverride = await db.AutomationClientOverrides
            .FirstOrDefaultAsync(o => o.AutomationRuleId == rule.Id && o.ClientProfileId == context.Client.Id, ct);

        if (clientOverride is null)
        {
            await this.SendProblemAsync(
                StatusCodes.Status409Conflict,
                ErrorCodes.AutomationNoOverrideToReset,
                "The rule has no override for this client.",
                ct);
            return;
        }

        db.AutomationClientOverrides.Remove(clientOverride);
        await db.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }
}

using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Authorization;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Automations.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Automations.OverrideClientAutomation;

/// <summary>
/// Customises a global rule's message, trigger and options for one client. Any existing pause is kept.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="linkAuthorizationService">Resolves link capabilities.</param>
[RemovedCoachRole(RemovedCoachRoleMode.Refuse)]
public class OverrideClientAutomationEndpoint(IApplicationDbContext db, IClientLinkAuthorizationService linkAuthorizationService)
    : Endpoint<OverrideClientAutomationRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/trainer/clients/{ClientId}/automations/{RuleId}/override");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Customise a rule for one client";
            s.Description = "Stores a per-client copy of the rule's message, trigger and options.";
            s.Responses[StatusCodes.Status204NoContent] = "Override saved";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid trigger or options";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status403Forbidden] = "The live link grants no access";
            s.Responses[StatusCodes.Status404NotFound] = "No live link to the client, or the rule does not apply to them";
            s.Responses[StatusCodes.Status409Conflict] = "A client-only rule is changed through the rule itself";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(OverrideClientAutomationRequest req, CancellationToken ct)
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
            clientOverride = new AutomationClientOverride
            {
                AutomationRuleId = rule.Id,
                ClientProfileId = context.Client.Id,
            };
            db.AutomationClientOverrides.Add(clientOverride);
        }

        AutomationRuleWriter.Apply(clientOverride, req);
        await db.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }
}

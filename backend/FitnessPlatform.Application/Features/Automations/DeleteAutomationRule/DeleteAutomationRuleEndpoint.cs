using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Authorization;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Automations.Shared;
using FitnessPlatform.Application.Infrastructure.Data;

namespace FitnessPlatform.Application.Features.Automations.DeleteAutomationRule;

/// <summary>
/// Deletes one of the caller's automation rules together with its overrides, schedules and run log.
/// </summary>
/// <param name="db">Application database context.</param>
[RemovedCoachRole(RemovedCoachRoleMode.Refuse)]
public class DeleteAutomationRuleEndpoint(IApplicationDbContext db)
    : Endpoint<DeleteAutomationRuleRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/trainer/automations/rules/{RuleId}");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Delete an automation rule";
            s.Description = "Deletes a rule owned by the caller, with everything that hangs off it.";
            s.Responses[StatusCodes.Status204NoContent] = "Rule deleted";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status404NotFound] = "Rule not found, or owned by another coach";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteAutomationRuleRequest req, CancellationToken ct)
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

        db.AutomationRules.Remove(rule);
        await db.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }
}

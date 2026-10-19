using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.Automations.Shared;
using FitnessPlatform.Application.Infrastructure.Data;

namespace FitnessPlatform.Application.Features.Automations.GetAutomationRule;

/// <summary>
/// Returns one of the caller's automation rules (global or client-only).
/// </summary>
/// <param name="db">Application database context.</param>
public class GetAutomationRuleEndpoint(IApplicationDbContext db)
    : Endpoint<GetAutomationRuleRequest, AutomationRuleDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/automations/rules/{RuleId}");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get an automation rule";
            s.Description = "Returns one rule owned by the caller.";
            s.Responses[StatusCodes.Status200OK] = "The rule";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status404NotFound] = "Rule not found, or owned by another coach";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetAutomationRuleRequest req, CancellationToken ct)
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

        var rule = await this.LoadOwnedRuleOrRespondAsync(db, profile.Id, req.RuleId, track: false, ct);

        if (rule is null)
        {
            return;
        }

        await Send.OkAsync(AutomationRuleDto.FromEntity(rule), ct);
    }
}

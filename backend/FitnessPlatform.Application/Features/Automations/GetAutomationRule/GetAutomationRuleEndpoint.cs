using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.Automations.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;

namespace FitnessPlatform.Application.Features.Automations.GetAutomationRule;

/// <summary>
/// Returns one of the caller's automation rules (global or client-only).
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="mongo">MongoDB context, read for plan-event send dates.</param>
/// <param name="timeProvider">Clock.</param>
public class GetAutomationRuleEndpoint(IApplicationDbContext db, IMongoContext mongo, TimeProvider timeProvider)
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
            s.Description = "Returns one rule owned by the caller, with its coverage summary.";
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

        var covered = await AutomationCoverage.LoadCoveredClientsAsync(db, profile.Id, ct);
        var summaries = await AutomationRuleSummaryBuilder.BuildSummariesAsync(
            db, mongo, profile.UserId, [rule], covered, timeProvider.GetUtcNow().UtcDateTime, ct);

        var dto = AutomationRuleDto.FromEntity(rule);
        dto.Summary = summaries[rule.Id];

        await Send.OkAsync(dto, ct);
    }
}

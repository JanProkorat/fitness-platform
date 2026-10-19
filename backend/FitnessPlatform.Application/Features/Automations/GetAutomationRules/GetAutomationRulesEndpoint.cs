using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.Automations.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Automations.GetAutomationRules;

/// <summary>
/// Lists the caller's global automation rules.
/// </summary>
/// <param name="db">Application database context.</param>
public class GetAutomationRulesEndpoint(IApplicationDbContext db)
    : EndpointWithoutRequest<GetAutomationRulesResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/automations/rules");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "List automation rules";
            s.Description = "Returns the caller's global rules; client-only rules are listed on the client.";
            s.Responses[StatusCodes.Status200OK] = "The caller's global rules";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status404NotFound] = "Caller has no professional profile";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
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

        var rules = await db.AutomationRules
            .AsNoTracking()
            .Where(r => r.OwnerProfessionalProfileId == profile.Id && r.ClientProfileId == null)
            .OrderBy(r => r.DateCreated)
            .ThenBy(r => r.Id)
            .WithDetails()
            .ToListAsync(ct);

        await Send.OkAsync(new GetAutomationRulesResponse { Rules = rules.Select(AutomationRuleDto.FromEntity).ToList() }, ct);
    }
}

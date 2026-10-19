using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Authorization;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Automations.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Automations.CreateAutomationRule;

/// <summary>
/// Creates a global automation rule owned by the caller.
/// </summary>
/// <param name="db">Application database context.</param>
[RemovedCoachRole(RemovedCoachRoleMode.Refuse)]
public class CreateAutomationRuleEndpoint(IApplicationDbContext db)
    : Endpoint<CreateAutomationRuleRequest, AutomationRuleDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/trainer/automations/rules");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Create an automation rule";
            s.Description = "Creates a global rule. A missing audience means all clients.";
            s.Responses[StatusCodes.Status200OK] = "The created rule";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid rule, or the questionnaire is inactive or a check-in form";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status404NotFound] =
                "Caller has no professional profile, or the questionnaire, tag or a chosen client was not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateAutomationRuleRequest req, CancellationToken ct)
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

        var (questionnaireOk, questionnaireId) =
            await this.ResolveQuestionnaireOrRespondAsync(db, Guid.Parse(userId), req, ct);

        if (!questionnaireOk)
        {
            return;
        }

        var audience = await this.ResolveAudienceOrRespondAsync(
            db, profile, req, req.Audience ?? AutomationAudience.All, ct);

        if (audience is null)
        {
            return;
        }

        var rule = new AutomationRule
        {
            PublicId = Guid.NewGuid(),
            OwnerProfessionalProfileId = profile.Id,
            Name = req.Name.Trim(),
            ActionType = req.ActionType,
            QuestionnaireId = questionnaireId,
            Audience = audience.Value.Audience,
            AudienceTagId = audience.Value.TagId,
            AudienceClients = audience.Value.ClientProfileIds
                .Select(id => new AutomationRuleAudienceClient { ClientProfileId = id })
                .ToList(),
        };
        AutomationRuleWriter.Apply(rule, req);

        db.AutomationRules.Add(rule);
        await db.SaveChangesAsync(ct);

        var saved = await db.AutomationRules
            .AsNoTracking()
            .Where(r => r.Id == rule.Id)
            .WithDetails()
            .FirstAsync(ct);

        await Send.OkAsync(AutomationRuleDto.FromEntity(saved), ct);
    }
}

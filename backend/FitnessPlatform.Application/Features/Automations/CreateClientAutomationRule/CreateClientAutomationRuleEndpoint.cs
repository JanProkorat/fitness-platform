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

namespace FitnessPlatform.Application.Features.Automations.CreateClientAutomationRule;

/// <summary>
/// Adds an automation rule that applies to one client only.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="linkAuthorizationService">Resolves link capabilities.</param>
[RemovedCoachRole(RemovedCoachRoleMode.Refuse)]
public class CreateClientAutomationRuleEndpoint(IApplicationDbContext db, IClientLinkAuthorizationService linkAuthorizationService)
    : Endpoint<CreateClientAutomationRuleRequest, AutomationRuleDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/trainer/clients/{ClientId}/automations");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Add a client-only automation rule";
            s.Description = "Creates a rule that applies to this client only.";
            s.Responses[StatusCodes.Status200OK] = "The created rule";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid rule, or the questionnaire is inactive or a check-in form";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status403Forbidden] = "The live link grants no access";
            s.Responses[StatusCodes.Status404NotFound] = "No live link to the client, or the questionnaire was not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateClientAutomationRuleRequest req, CancellationToken ct)
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

        var (questionnaireOk, questionnaireId) =
            await this.ResolveQuestionnaireOrRespondAsync(db, Guid.Parse(userId), req, ct);

        if (!questionnaireOk)
        {
            return;
        }

        var rule = new AutomationRule
        {
            PublicId = Guid.NewGuid(),
            OwnerProfessionalProfileId = context.Profile.Id,
            ClientProfileId = context.Client.Id,
            Name = req.Name.Trim(),
            ActionType = req.ActionType,
            QuestionnaireId = questionnaireId,
            Audience = AutomationAudience.All,
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

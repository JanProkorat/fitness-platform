using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Authorization;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.Automations.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Automations.PauseClientAutomation;

/// <summary>
/// Pauses or resumes a global rule for one client. A pause with an end date lapses on its own.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="linkAuthorizationService">Resolves link capabilities.</param>
/// <param name="timeProvider">Clock.</param>
[RemovedCoachRole(RemovedCoachRoleMode.Refuse)]
public class PauseClientAutomationEndpoint(
    IApplicationDbContext db,
    IClientLinkAuthorizationService linkAuthorizationService,
    TimeProvider timeProvider)
    : Endpoint<PauseClientAutomationRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/trainer/clients/{ClientId}/automations/{RuleId}/pause");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Pause or resume a rule for one client";
            s.Description = "Pauses the rule for the client, optionally until a client-local date, with a short note.";
            s.Responses[StatusCodes.Status204NoContent] = "Pause state saved";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid pause details, or an end date in the past";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status403Forbidden] = "The live link grants no access";
            s.Responses[StatusCodes.Status404NotFound] = "No live link to the client, or the rule does not apply to them";
            s.Responses[StatusCodes.Status409Conflict] = "A client-only rule is changed through the rule itself";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(PauseClientAutomationRequest req, CancellationToken ct)
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

        var localToday = ClientLocalDateResolver.ResolveLocalDate(
            timeProvider.GetUtcNow().UtcDateTime,
            ClientLocalDateResolver.ResolveTimeZone(context.Client.User.TimeZone));

        if (req.IsPaused && req.PausedUntil is not null && req.PausedUntil.Value < localToday)
        {
            this.ThrowErrorWithCode(ErrorCodes.AutomationPausedUntilInPast, "The pause cannot end in the past.");
        }

        var clientOverride = await db.AutomationClientOverrides
            .FirstOrDefaultAsync(o => o.AutomationRuleId == rule.Id && o.ClientProfileId == context.Client.Id, ct);

        if (req.IsPaused)
        {
            if (clientOverride is null)
            {
                clientOverride = new AutomationClientOverride
                {
                    AutomationRuleId = rule.Id,
                    ClientProfileId = context.Client.Id,
                };
                db.AutomationClientOverrides.Add(clientOverride);
            }

            clientOverride.IsPaused = true;
            clientOverride.PausedUntil = req.PausedUntil;
            clientOverride.PauseNote = string.IsNullOrWhiteSpace(req.PauseNote) ? null : req.PauseNote.Trim();
        }
        else if (clientOverride is not null)
        {
            clientOverride.IsPaused = false;
            clientOverride.PausedUntil = null;
            clientOverride.PauseNote = null;

            if (!clientOverride.IsCustomized)
            {
                db.AutomationClientOverrides.Remove(clientOverride);
            }
        }

        await db.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }
}

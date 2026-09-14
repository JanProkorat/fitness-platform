using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.GetClientProgress;

/// <summary>
/// Endpoint for retrieving a client's progress data from the trainer's perspective.
/// The requesting trainer must have an active link to the client.
/// </summary>
/// <param name="complianceService">Service for calculating compliance metrics.</param>
/// <param name="linkAuthorizationService">Resolves link capabilities. This
/// endpoint is deliberately dual-readable by Trainers and Nutritionists, so it checks
/// <see cref="Domain.Entities.LinkCapabilities.GrantsNothing"/> (either capability flag)
/// rather than requiring a specific single domain.</param>
/// <param name="audit">Audit logging service.</param>
/// <param name="db">Relational database context — resolves the client's public id to
/// ApplicationUser.Id, the canonical clientId key ComplianceService reads from Mongo (#840).</param>
public class GetClientProgressEndpoint(
    IComplianceService complianceService,
    IClientLinkAuthorizationService linkAuthorizationService,
    IAuditService audit,
    IApplicationDbContext db)
    : Endpoint<GetClientProgressRequest, GetClientProgressResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/clients/{ClientId}/progress");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get client progress";
            s.Description = "Returns compliance, macros, and streak data for a specific client managed by the authenticated trainer.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientProgressRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerUserId = Guid.Parse(userId);

        // Either flag admits the caller — that part was always right, and this route is reachable
        // by a Trainer or a Nutritionist by design. What was missing is that the BODY is not
        // domain-neutral: the meal counts and macro averages are nutrition data, and the compliance
        // percentage and streak are combined cross-domain figures. Read the flags, not a boolean,
        // so the response can be shaped as well as admitted.
        var capabilities = await linkAuthorizationService.GetCapabilitiesByClientPublicIdAsync(
            trainerUserId, req.ClientId, ct);

        if (capabilities is null || capabilities.Value.GrantsNothing)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // req.ClientId is the client's public id — resolve to ApplicationUser.Id before
        // calling ComplianceService, which reads Mongo documents keyed on that id (#840).
        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.PublicId == req.ClientId, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var clientUserId = clientProfile.UserId;

        var from = req.From ?? DateTime.UtcNow.Date.AddDays(-7);
        var to = req.To ?? DateTime.UtcNow.Date.AddDays(1).AddTicks(-1);

        var discipline = capabilities.Value.Discipline;

        var compliance = await complianceService.CalculateComplianceAsync(clientUserId, from, to, ct);

        // The streak overload without a discipline hard-codes the combined figure, so a
        // single-flag caller was receiving a number weighted by the domain their link denies.
        var streak = await complianceService.CalculateStreakAsync(clientUserId, discipline, ct);

        // Not computed at all unless the caller may see it — the averages are derived from the
        // client's meal logs and nutrition plan.
        var averageMacros = capabilities.Value.CanViewNutritionPlans
            ? await complianceService.CalculateAverageMacrosAsync(clientUserId, from, to, ct)
            : null;

        // Audit: trainer accessing client health/progress data
        await audit.LogAsync(
            trainerUserId,
            "Read",
            "ClientProgress",
            req.ClientId,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            ct: ct);

        await Send.OkAsync(new GetClientProgressResponse
        {
            // The caller's own domain's figure, not the combined weighted one — returning the
            // latter to a single-flag caller discloses the other domain's adherence by inference.
            CompliancePercent = discipline switch
            {
                ComplianceDiscipline.NutritionOnly => compliance.NutritionCompliancePercent,
                ComplianceDiscipline.TrainingOnly => compliance.TrainingCompliancePercent,
                _ => compliance.CompliancePercent
            },
            MealsPlanned = capabilities.Value.CanViewNutritionPlans ? compliance.MealsPlanned : null,
            MealsLogged = capabilities.Value.CanViewNutritionPlans ? compliance.MealsLogged : null,
            CurrentStreak = streak,
            AverageDailyMacros = averageMacros,
            From = from,
            To = to
        }, ct);
    }
}

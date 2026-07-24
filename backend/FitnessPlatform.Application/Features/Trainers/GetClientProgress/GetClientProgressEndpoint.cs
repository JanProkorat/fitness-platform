using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.GetClientProgress;

/// <summary>
/// Endpoint for retrieving a client's progress data from the trainer's perspective.
/// The requesting trainer must have an active link to the client.
/// </summary>
/// <param name="complianceService">Service for calculating compliance metrics.</param>
/// <param name="authHelper">Helper for verifying trainer-client relationships.</param>
/// <param name="audit">Audit logging service.</param>
/// <param name="db">Relational database context — resolves the client's public id to
/// ApplicationUser.Id, the canonical clientId key ComplianceService reads from Mongo (#840).</param>
public class GetClientProgressEndpoint(
    IComplianceService complianceService,
    NutritionAuthHelper authHelper,
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

        // Verify active trainer-client link
        var hasLink = await authHelper.HasActiveLinkAsync(trainerUserId, req.ClientId, ct);

        if (!hasLink)
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

        var compliance = await complianceService.CalculateComplianceAsync(clientUserId, from, to, ct);
        var streak = await complianceService.CalculateStreakAsync(clientUserId, ct);
        var averageMacros = await complianceService.CalculateAverageMacrosAsync(clientUserId, from, to, ct);

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
            CompliancePercent = compliance.CompliancePercent,
            MealsPlanned = compliance.MealsPlanned,
            MealsLogged = compliance.MealsLogged,
            CurrentStreak = streak,
            AverageDailyMacros = averageMacros,
            From = from,
            To = to
        }, ct);
    }
}

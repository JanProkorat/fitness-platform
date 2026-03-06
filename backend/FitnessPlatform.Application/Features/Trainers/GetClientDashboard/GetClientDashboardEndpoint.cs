using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.GetClientDashboard;

/// <summary>
/// Endpoint for retrieving a client's dashboard summary.
/// The requesting trainer must have an active link to the client.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="audit">Audit logging service.</param>
public class GetClientDashboardEndpoint(IApplicationDbContext db, IAuditService audit)
    : Endpoint<GetClientDashboardRequest, GetClientDashboardResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/clients/{clientId}");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get client dashboard";
            s.Description = "Returns a summary dashboard for a specific client managed by the authenticated trainer.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientDashboardRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        // Find the trainer's profile
        var trainerProfile = await db.TrainerProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(tp => tp.UserId == Guid.Parse(userId), ct);

        if (trainerProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Find the client profile by PublicId
        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .Include(cp => cp.User)
            .FirstOrDefaultAsync(cp => cp.PublicId == req.ClientId, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Verify an active trainer-client link exists
        var link = await db.ClientTrainerLinks
            .AsNoTracking()
            .FirstOrDefaultAsync(ctl =>
                ctl.TrainerProfileId == trainerProfile.Id &&
                ctl.ClientProfileId == clientProfile.Id &&
                ctl.IsActive, ct);

        if (link is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Count body measurements and progress photos
        var totalMeasurements = await db.BodyMeasurements
            .AsNoTracking()
            .CountAsync(bm => bm.ClientProfileId == clientProfile.Id, ct);

        var totalProgressPhotos = await db.ProgressPhotos
            .AsNoTracking()
            .CountAsync(pp => pp.ClientProfileId == clientProfile.Id, ct);

        // Get the latest body measurement
        var latestMeasurement = await db.BodyMeasurements
            .AsNoTracking()
            .Where(bm => bm.ClientProfileId == clientProfile.Id)
            .OrderByDescending(bm => bm.MeasuredAt)
            .Select(bm => new LatestMeasurementDto
            {
                MeasuredAt = bm.MeasuredAt,
                WeightKg = bm.WeightKg,
                BodyFatPercentage = bm.BodyFatPercentage
            })
            .FirstOrDefaultAsync(ct);

        // Audit: trainer accessing client health data
        await audit.LogAsync(
            Guid.Parse(userId),
            "Read",
            nameof(ClientProfile),
            clientProfile.PublicId,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            ct: ct);

        await Send.OkAsync(new GetClientDashboardResponse
        {
            ClientPublicId = clientProfile.PublicId,
            Email = clientProfile.User.Email!,
            FirstName = clientProfile.User.FirstName,
            LastName = clientProfile.User.LastName,
            DateOfBirth = clientProfile.DateOfBirth,
            HeightCm = clientProfile.HeightCm,
            WeightKg = clientProfile.WeightKg,
            Goals = clientProfile.Goals,
            LinkedAt = link.DateCreated,
            IsActive = link.IsActive,
            TotalMeasurements = totalMeasurements,
            TotalProgressPhotos = totalProgressPhotos,
            LatestMeasurement = latestMeasurement
        }, ct);
    }
}

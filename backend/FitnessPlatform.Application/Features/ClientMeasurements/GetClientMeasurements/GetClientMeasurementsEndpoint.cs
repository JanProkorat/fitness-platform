using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientMeasurements.GetMeasurements;
using FitnessPlatform.Application.Features.ClientMeasurements.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.ClientMeasurements.GetClientMeasurements;

/// <summary>
/// Allows a trainer or nutritionist to retrieve a client's body measurements.
/// Verifies an active trainer-client link exists before granting access.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="audit">Audit logging service.</param>
public class GetClientMeasurementsEndpoint(IApplicationDbContext db, IAuditService audit)
    : Endpoint<GetClientMeasurementsRequest, GetMeasurementsResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/clients/{ClientId}/measurements");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get a client's body measurements";
            s.Description = "Returns a paginated list of body measurements for the specified client. Requires an active trainer-client relationship.";
            s.Responses[404] = "Client not found or no active relationship";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientMeasurementsRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        var trainerProfile = await db.TrainerProfiles
            .FirstOrDefaultAsync(tp => tp.UserId == trainerId, ct);

        if (trainerProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var clientProfile = await db.ClientProfiles
            .FirstOrDefaultAsync(cp => cp.PublicId == req.ClientId, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Verify active trainer-client link
        var hasActiveLink = await db.ClientTrainerLinks
            .AnyAsync(l => l.ClientProfileId == clientProfile.Id
                        && l.TrainerProfileId == trainerProfile.Id
                        && l.IsActive, ct);

        if (!hasActiveLink)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var query = db.BodyMeasurements
            .Where(m => m.ClientProfileId == clientProfile.Id);

        if (req.From.HasValue)
        {
            query = query.Where(m => m.MeasuredAt >= req.From.Value);
        }

        if (req.To.HasValue)
        {
            query = query.Where(m => m.MeasuredAt <= req.To.Value);
        }

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(m => m.MeasuredAt)
            .Skip((req.Page - 1) * req.PageSize)
            .Take(req.PageSize)
            .Select(m => MeasurementDto.FromEntity(m))
            .ToListAsync(ct);

        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

        await audit.LogAsync(
            trainerId,
            "Read",
            nameof(BodyMeasurement),
            clientProfile.PublicId,
            ipAddress,
            ct: ct);

        await Send.OkAsync(new GetMeasurementsResponse
        {
            Items = items,
            TotalCount = totalCount,
            Page = req.Page,
            PageSize = req.PageSize
        }, ct);
    }
}

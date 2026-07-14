using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientMeasurements.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.ClientMeasurements.AddClientMeasurement;

/// <summary>
/// Allows a trainer or nutritionist to record a body measurement on behalf of
/// a linked client (e.g. values measured in person during a session).
/// Verifies an active trainer-client link exists before granting access.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="audit">Audit logging service.</param>
public class AddClientMeasurementEndpoint(IApplicationDbContext db, IAuditService audit)
    : Endpoint<AddClientMeasurementRequest, MeasurementDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/trainer/clients/{ClientId}/measurements");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Record a client's body measurement";
            s.Description = "Creates a new body measurement for the specified client on behalf of the trainer/nutritionist. Requires an active trainer-client relationship.";
            s.Responses[201] = "Measurement created";
            s.Responses[401] = "Unauthorized";
            s.Responses[404] = "Client not found or no active relationship";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(AddClientMeasurementRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        var professionalProfile = await db.ProfessionalProfiles
            .FirstOrDefaultAsync(tp => tp.UserId == trainerId, ct);

        if (professionalProfile is null)
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
        var hasActiveLink = await db.ClientProfessionalLinks
            .AnyAsync(l => l.ClientProfileId == clientProfile.Id
                        && l.ProfessionalProfileId == professionalProfile.Id
                        && l.IsActive, ct);

        if (!hasActiveLink)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var entity = new BodyMeasurement
        {
            ClientProfileId = clientProfile.Id,
            MeasuredAt = req.MeasuredAt,
            WeightKg = req.WeightKg,
            BodyFatPercentage = req.BodyFatPercentage,
            ChestCm = req.ChestCm,
            WaistCm = req.WaistCm,
            HipsCm = req.HipsCm,
            BicepsCm = req.BicepsCm,
            ThighsCm = req.ThighsCm,
            Notes = req.Notes
        };

        db.BodyMeasurements.Add(entity);
        await db.SaveChangesAsync(ct);

        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

        await audit.LogAsync(
            trainerId,
            "Create",
            nameof(BodyMeasurement),
            clientProfile.PublicId,
            ipAddress,
            ct: ct);

        await Send.ResponseAsync(MeasurementDto.FromEntity(entity), StatusCodes.Status201Created, ct);
    }
}

using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Features.ClientMeasurements.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.ClientMeasurements.AddMeasurement;

/// <summary>
/// Creates a new body measurement record for the authenticated client.
/// </summary>
/// <param name="db">Database context.</param>
public class AddMeasurementEndpoint(IApplicationDbContext db) : Endpoint<AddMeasurementRequest, MeasurementDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/measurements");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Add a body measurement";
            s.Description = "Records a new body measurement for the authenticated client.";
            s.Responses[201] = "Measurement created";
            s.Responses[401] = "Unauthorized";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(AddMeasurementRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientId = Guid.Parse(userId);

        var clientProfile = await db.ClientProfiles
            .FirstOrDefaultAsync(cp => cp.UserId == clientId, ct);

        if (clientProfile is null)
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

        await Send.ResponseAsync(MeasurementDto.FromEntity(entity), StatusCodes.Status201Created, ct);
    }
}

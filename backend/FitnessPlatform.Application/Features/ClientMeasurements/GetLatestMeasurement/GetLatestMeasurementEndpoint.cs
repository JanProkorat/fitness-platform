using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.ClientMeasurements.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.ClientMeasurements.GetLatestMeasurement;

/// <summary>
/// Retrieves the most recent body measurement for the authenticated client.
/// </summary>
/// <param name="db">Database context.</param>
public class GetLatestMeasurementEndpoint(IApplicationDbContext db) : EndpointWithoutRequest<MeasurementDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/measurements/latest");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get latest body measurement";
            s.Description = "Returns the most recent body measurement for the authenticated client.";
            s.Responses[404] = "No measurements found";
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

        var clientId = Guid.Parse(userId);

        var clientProfile = await db.ClientProfiles
            .FirstOrDefaultAsync(cp => cp.UserId == clientId, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var latest = await db.BodyMeasurements
            .Where(m => m.ClientProfileId == clientProfile.Id)
            .OrderByDescending(m => m.MeasuredAt)
            .FirstOrDefaultAsync(ct);

        if (latest is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(MeasurementDto.FromEntity(latest), ct);
    }
}

using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.ClientMeasurements.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.ClientMeasurements.GetMeasurements;

/// <summary>
/// Retrieves a paginated list of body measurements for the authenticated client.
/// </summary>
/// <param name="db">Database context.</param>
public class GetMeasurementsEndpoint(IApplicationDbContext db) : Endpoint<GetMeasurementsRequest, GetMeasurementsResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/measurements");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "List body measurements";
            s.Description = "Returns a paginated list of body measurements for the authenticated client with optional date filtering.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetMeasurementsRequest req, CancellationToken ct)
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

        await Send.OkAsync(new GetMeasurementsResponse
        {
            Items = items,
            TotalCount = totalCount,
            Page = req.Page,
            PageSize = req.PageSize
        }, ct);
    }
}

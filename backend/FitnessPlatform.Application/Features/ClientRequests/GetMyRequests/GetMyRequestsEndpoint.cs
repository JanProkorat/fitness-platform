using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.ClientRequests.GetMyRequests;

/// <summary>
/// Endpoint for a client to retrieve their sent requests.
/// </summary>
public class GetMyRequestsEndpoint(IApplicationDbContext db) : EndpointWithoutRequest<GetMyRequestsResponse>
{
    public override void Configure()
    {
        Get("/client/requests");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get my requests";
            s.Description = "Returns all requests sent by the authenticated client, ordered by most recent first.";
        });
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var userGuid = Guid.Parse(userId);

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == userGuid, ct);

        if (clientProfile is null)
        {
            await Send.OkAsync(new GetMyRequestsResponse(), ct);
            return;
        }

        var requests = await db.ClientRequests
            .AsNoTracking()
            .Where(r => r.ClientProfileId == clientProfile.Id)
            .Include(r => r.ProfessionalProfile)
                .ThenInclude(pp => pp.User)
            .OrderByDescending(r => r.SentAt)
            .Select(r => new ClientRequestDto
            {
                PublicId = r.PublicId,
                ProfessionalPublicId = r.ProfessionalProfile.PublicId,
                ProfessionalName = r.ProfessionalProfile.User.FirstName + " " + r.ProfessionalProfile.User.LastName,
                Message = r.Message,
                Status = r.Status,
                SentAt = r.SentAt,
                RespondedAt = r.RespondedAt
            })
            .ToListAsync(ct);

        await Send.OkAsync(new GetMyRequestsResponse { Requests = requests }, ct);
    }
}

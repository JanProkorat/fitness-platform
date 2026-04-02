using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.ClientRequests.GetIncomingRequests;

/// <summary>
/// Endpoint for a professional to retrieve incoming pending client requests.
/// </summary>
public class GetIncomingRequestsEndpoint(IApplicationDbContext db) : EndpointWithoutRequest<GetIncomingRequestsResponse>
{
    public override void Configure()
    {
        Get("/trainer/client-requests");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist, AppRoles.Admin);
        Summary(s =>
        {
            s.Summary = "Get incoming client requests";
            s.Description = "Returns all pending client requests for the authenticated professional.";
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

        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(pp => pp.UserId == userGuid, ct);

        if (professionalProfile is null)
        {
            await Send.OkAsync(new GetIncomingRequestsResponse(), ct);
            return;
        }

        var requests = await db.ClientRequests
            .AsNoTracking()
            .Where(r => r.ProfessionalProfileId == professionalProfile.Id
                     && r.Status == ClientRequestStatus.Pending)
            .Include(r => r.ClientProfile)
                .ThenInclude(cp => cp.User)
            .OrderByDescending(r => r.SentAt)
            .Select(r => new IncomingClientRequestDto
            {
                PublicId = r.PublicId,
                ClientFirstName = r.ClientProfile.User.FirstName ?? string.Empty,
                ClientLastName = r.ClientProfile.User.LastName ?? string.Empty,
                ClientEmail = r.ClientProfile.User.Email ?? string.Empty,
                Message = r.Message,
                SentAt = r.SentAt
            })
            .ToListAsync(ct);

        await Send.OkAsync(new GetIncomingRequestsResponse { Requests = requests }, ct);
    }
}

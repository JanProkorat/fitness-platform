using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.GetClients;

/// <summary>
/// Endpoint for retrieving the list of clients managed by the authenticated trainer.
/// </summary>
/// <param name="db">Database context.</param>
public class GetClientsEndpoint(IApplicationDbContext db) : Endpoint<GetClientsRequest, GetClientsResponse>
{

    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/clients");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get trainer's clients";
            s.Description = "Returns a paginated list of clients managed by the authenticated trainer or nutritionist.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientsRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(tp => tp.UserId == Guid.Parse(userId), ct);

        if (professionalProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var query = db.ClientProfessionalLinks
            .AsNoTracking()
            .Where(ctl => ctl.ProfessionalProfileId == professionalProfile.Id && ctl.IsActive)
            .Include(ctl => ctl.ClientProfile)
            .ThenInclude(cp => cp.User)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(req.Search))
        {
            var search = req.Search.ToLower();
            query = query.Where(ctl =>
                ctl.ClientProfile.User.FirstName.ToLower().Contains(search) ||
                ctl.ClientProfile.User.LastName.ToLower().Contains(search) ||
                ctl.ClientProfile.User.Email!.ToLower().Contains(search));
        }

        var totalCount = await query.CountAsync(ct);

        var clients = await query
            .OrderByDescending(ctl => ctl.DateCreated)
            .Skip((req.Page - 1) * req.PageSize)
            .Take(req.PageSize)
            .Select(ctl => new ClientSummary
            {
                LinkId = ctl.Id,
                PublicId = ctl.ClientProfile.PublicId,
                Email = ctl.ClientProfile.User.Email!,
                FirstName = ctl.ClientProfile.User.FirstName,
                LastName = ctl.ClientProfile.User.LastName,
                IsActive = ctl.IsActive,
                LinkedAt = ctl.DateCreated
            })
            .ToListAsync(ct);

        await Send.OkAsync(new GetClientsResponse
        {
            Clients = clients,
            TotalCount = totalCount,
            Page = req.Page,
            PageSize = req.PageSize
        }, ct);
    }
}

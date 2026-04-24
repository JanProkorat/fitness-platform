using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Client.Collaborations.GetAll;

/// <summary>
/// Returns the client's active professional collaborations.
/// </summary>
public class GetCollaborationsEndpoint(IApplicationDbContext db) : EndpointWithoutRequest<GetCollaborationsResponse>
{
    public override void Configure()
    {
        Get("/client/collaborations");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get active collaborations";
            s.Description = "Returns all active professional links for the authenticated client.";
        });
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        var userGuid = Guid.Parse(userId);

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == userGuid, ct);

        if (clientProfile is null)
        {
            await Send.OkAsync(new GetCollaborationsResponse(), ct);
            return;
        }

        var links = await db.ClientProfessionalLinks
            .AsNoTracking()
            .Where(l => l.ClientProfileId == clientProfile.Id && l.IsActive)
            .Include(l => l.ProfessionalProfile)
                .ThenInclude(pp => pp.User)
            .Select(l => new CollaborationDto
            {
                PublicId = l.PublicId,
                ProfessionalPublicId = l.ProfessionalProfile.PublicId,
                ProfessionalName = l.ProfessionalProfile.User.FirstName + " " + l.ProfessionalProfile.User.LastName,
                ProfessionalCity = l.ProfessionalProfile.City,
                Role = l.ProfessionalRole.ToString(),
                Since = l.DateCreated,
                // Same fallback as SearchProfessionals / GetPublicProfile:
                // surface the personal user avatar when the pro-profile one
                // hasn't been set (most trainers upload only one photo today).
                AvatarBlobUrl = l.ProfessionalProfile.AvatarBlobUrl ?? l.ProfessionalProfile.User.AvatarBlobUrl
            })
            .OrderBy(l => l.Role)
            .ToListAsync(ct);

        await Send.OkAsync(new GetCollaborationsResponse { Collaborations = links }, ct);
    }
}

public class GetCollaborationsResponse
{
    public List<CollaborationDto> Collaborations { get; set; } = [];
}

public class CollaborationDto
{
    public Guid PublicId { get; set; }
    public Guid ProfessionalPublicId { get; set; }
    public string ProfessionalName { get; set; } = string.Empty;
    public string? ProfessionalCity { get; set; }
    public string Role { get; set; } = string.Empty;
    public DateTime Since { get; set; }
    /// <summary>
    /// Professional's avatar URL. Falls back to the underlying user's
    /// personal avatar when the professional-profile-specific one isn't set.
    /// Null when neither is uploaded.
    /// </summary>
    public string? AvatarBlobUrl { get; set; }
}

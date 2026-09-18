using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.ClientTags.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.ClientTags.GetClientTags;

/// <summary>
/// Lists the tags owned by the calling professional.
/// </summary>
/// <param name="db">Application database context.</param>
public class GetClientTagsEndpoint(IApplicationDbContext db) : EndpointWithoutRequest<GetClientTagsResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/client-tags");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "List client tags";
            s.Description = "Returns every tag owned by the calling professional.";
            s.Responses[StatusCodes.Status200OK] = "The caller's tags";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status404NotFound] = "Caller has no professional profile";
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

        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == Guid.Parse(userId), ct);

        if (professionalProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var tags = await db.ClientTags
            .AsNoTracking()
            .Where(t => t.OwnerProfessionalProfileId == professionalProfile.Id)
            .OrderBy(t => t.Name)
            .Select(t => new ClientTagDto
            {
                TagId = t.PublicId,
                Name = t.Name,
                Description = t.Description,
                ColorHex = t.ColorHex,
            })
            .ToListAsync(ct);

        await Send.OkAsync(new GetClientTagsResponse { Tags = tags }, ct);
    }
}

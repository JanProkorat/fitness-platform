using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.ClientTags.DeleteClientTag;

/// <summary>
/// Deletes a client tag and every assignment of it. Only the owning professional may delete.
/// </summary>
/// <param name="db">Application database context.</param>
public class DeleteClientTagEndpoint(IApplicationDbContext db) : Endpoint<DeleteClientTagRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/trainer/client-tags/{TagId}");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Delete a client tag";
            s.Description = "Permanently deletes a tag and every assignment of it. Only the owning professional may delete.";
            s.Responses[StatusCodes.Status204NoContent] = "Tag deleted";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status404NotFound] = "Tag not found, or owned by a different professional";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteClientTagRequest req, CancellationToken ct)
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

        // Single owner-filtered query — a tag owned by a different professional is
        // indistinguishable from one that does not exist at all.
        var tag = await db.ClientTags
            .FirstOrDefaultAsync(
                t => t.PublicId == req.TagId && t.OwnerProfessionalProfileId == professionalProfile.Id, ct);

        if (tag is null)
        {
            await this.SendProblemAsync(
                StatusCodes.Status404NotFound, ErrorCodes.ClientTagNotFound, "Client tag not found.", ct);
            return;
        }

        db.ClientTags.Remove(tag);
        await db.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }
}

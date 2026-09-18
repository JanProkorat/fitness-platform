using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.ClientTags.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.ClientTags.ReplaceClientTagAssignments;

/// <summary>
/// Replaces the full set of tags assigned to a client, scoped to the caller's own link. Tagging is
/// coach-private relationship metadata — it requires a live link but not either
/// <c>CanView*</c> capability flag.
/// </summary>
/// <param name="db">Application database context.</param>
public class ReplaceClientTagAssignmentsEndpoint(IApplicationDbContext db)
    : Endpoint<ReplaceClientTagAssignmentsRequest, ReplaceClientTagAssignmentsResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/trainer/clients/{ClientId}/tags");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Replace a client's tag assignments";
            s.Description = "Replaces the full set of tags assigned to the client for the caller's own link.";
            s.Responses[StatusCodes.Status200OK] = "The resulting tag set";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid request body";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status404NotFound] =
                "Client not found, caller has no active link to the client, or one or more tags were not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(ReplaceClientTagAssignmentsRequest req, CancellationToken ct)
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

        // Resolve client by PublicId. Existence is not distinguished from "no active link" below —
        // both collapse to a bare 404 so client existence does not leak to a coach with no
        // relationship to them.
        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.PublicId == req.ClientId, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Tagging requires a live link but not either CanView* capability flag — a tag is
        // coach-private relationship metadata, not plan data. Resolved by a direct query rather
        // than IClientLinkAuthorizationService because the assignment needs the link's own row id,
        // which the capability-only service does not expose.
        var link = await db.ClientProfessionalLinks
            .AsNoTracking()
            .FirstOrDefaultAsync(l =>
                l.ProfessionalProfileId == professionalProfile.Id &&
                l.ClientProfileId == clientProfile.Id &&
                l.IsActive, ct);

        if (link is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var distinctTagIds = req.TagIds.Distinct().ToList();

        var ownedTags = await db.ClientTags
            .AsNoTracking()
            .Where(t => t.OwnerProfessionalProfileId == professionalProfile.Id && distinctTagIds.Contains(t.PublicId))
            .ToListAsync(ct);

        if (ownedTags.Count != distinctTagIds.Count)
        {
            await this.SendProblemAsync(
                StatusCodes.Status404NotFound,
                ErrorCodes.ClientTagNotFound,
                "One or more tags were not found.",
                ct);
            return;
        }

        var existingAssignments = await db.ClientTagAssignments
            .Where(a => a.ClientProfessionalLinkId == link.Id)
            .ToListAsync(ct);

        var desiredTagIds = ownedTags.Select(t => t.Id).ToHashSet();
        var existingTagIds = existingAssignments.Select(a => a.ClientTagId).ToHashSet();

        var toRemove = existingAssignments.Where(a => !desiredTagIds.Contains(a.ClientTagId)).ToList();
        var toAdd = desiredTagIds
            .Where(tagId => !existingTagIds.Contains(tagId))
            .Select(tagId => new ClientTagAssignment { ClientTagId = tagId, ClientProfessionalLinkId = link.Id });

        db.ClientTagAssignments.RemoveRange(toRemove);
        db.ClientTagAssignments.AddRange(toAdd);

        await db.SaveChangesAsync(ct);

        await Send.OkAsync(new ReplaceClientTagAssignmentsResponse
        {
            ClientId = clientProfile.PublicId,
            Tags = ownedTags
                .OrderBy(t => t.Name)
                .Select(ClientTagDto.FromEntity)
                .ToList(),
        }, ct);
    }
}

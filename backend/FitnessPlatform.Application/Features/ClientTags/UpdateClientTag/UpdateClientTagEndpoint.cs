using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.ClientTags.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace FitnessPlatform.Application.Features.ClientTags.UpdateClientTag;

/// <summary>
/// Updates a client tag's name, description, and color. Only the owning professional may update.
/// </summary>
/// <param name="db">Application database context.</param>
public class UpdateClientTagEndpoint(IApplicationDbContext db)
    : Endpoint<UpdateClientTagRequest, ClientTagDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/trainer/client-tags/{TagId}");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Update a client tag";
            s.Description = "Renames, recolors, or redescribes a tag. Only the owning professional may update.";
            s.Responses[StatusCodes.Status200OK] = "Tag updated";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid request body";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status404NotFound] = "Tag not found, or owned by a different professional";
            s.Responses[StatusCodes.Status409Conflict] = "A different tag with this Name already exists for the caller";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateClientTagRequest req, CancellationToken ct)
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

        var name = req.Name.Trim();

        var nameTakenByAnotherTag = await db.ClientTags
            .AsNoTracking()
            .AnyAsync(t =>
                t.OwnerProfessionalProfileId == professionalProfile.Id &&
                t.Name == name &&
                t.PublicId != req.TagId, ct);

        if (nameTakenByAnotherTag)
        {
            await this.SendProblemAsync(
                StatusCodes.Status409Conflict,
                ErrorCodes.ClientTagNameAlreadyExists,
                "A tag with this Name already exists.",
                ct);
            return;
        }

        tag.Name = name;
        tag.Description = req.Description;
        tag.ColorHex = req.ColorHex.ToLowerInvariant();

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            // A concurrent request won the race on the (owner, name) unique index between the
            // AnyAsync pre-check above and this update.
            await this.SendProblemAsync(
                StatusCodes.Status409Conflict,
                ErrorCodes.ClientTagNameAlreadyExists,
                "A tag with this Name already exists.",
                ct);
            return;
        }
        catch (DbUpdateConcurrencyException)
        {
            // The owning professional concurrently deleted this tag between the owner-filtered
            // load above and this save, so the UPDATE affected 0 rows. The tag no longer exists,
            // so the owner-filtered load itself would now report the same 404 — matches
            // DeleteClientTagEndpoint's own handling of a concurrent delete racing its own delete.
            await this.SendProblemAsync(
                StatusCodes.Status404NotFound, ErrorCodes.ClientTagNotFound, "Client tag not found.", ct);
            return;
        }

        await Send.OkAsync(ClientTagDto.FromEntity(tag), ct);
    }

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException pgEx && pgEx.SqlState == "23505";
}

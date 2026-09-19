using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.ClientTags.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace FitnessPlatform.Application.Features.ClientTags.CreateClientTag;

/// <summary>
/// Creates a new client tag owned by the calling professional.
/// </summary>
/// <param name="db">Application database context.</param>
public class CreateClientTagEndpoint(IApplicationDbContext db)
    : Endpoint<CreateClientTagRequest, ClientTagDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/trainer/client-tags");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Create a client tag";
            s.Description = "Creates a new tag owned by the calling professional.";
            s.Responses[StatusCodes.Status201Created] = "Tag created";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid request body";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status404NotFound] = "Caller has no professional profile";
            s.Responses[StatusCodes.Status409Conflict] = "A tag with this Name already exists for the caller";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateClientTagRequest req, CancellationToken ct)
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

        var name = req.Name.Trim();

        var nameExists = await db.ClientTags
            .AsNoTracking()
            .AnyAsync(t => t.OwnerProfessionalProfileId == professionalProfile.Id && t.Name == name, ct);

        if (nameExists)
        {
            await this.SendProblemAsync(
                StatusCodes.Status409Conflict,
                ErrorCodes.ClientTagNameAlreadyExists,
                "A tag with this Name already exists.",
                ct);
            return;
        }

        var tag = new ClientTag
        {
            PublicId = Guid.NewGuid(),
            OwnerProfessionalProfileId = professionalProfile.Id,
            Name = name,
            Description = req.Description,
            ColorHex = req.ColorHex.ToLowerInvariant(),
        };

        db.ClientTags.Add(tag);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            // A concurrent request won the race on the (owner, name) unique index between the
            // AnyAsync pre-check above and this insert. Map it to the same 409 the pre-check
            // returns instead of letting it surface as an unhandled 500.
            await this.SendProblemAsync(
                StatusCodes.Status409Conflict,
                ErrorCodes.ClientTagNameAlreadyExists,
                "A tag with this Name already exists.",
                ct);
            return;
        }

        await Send.ResponseAsync(ClientTagDto.FromEntity(tag), StatusCodes.Status201Created, ct);
    }

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException pgEx && pgEx.SqlState == "23505";
}

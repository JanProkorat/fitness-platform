using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Trainers.ClientNotes.ListNotes;

/// <summary>
/// Lists trainer notes for a client, ordered by createdAt descending (newest first), paginated.
/// </summary>
public class ListNotesEndpoint(
    IApplicationDbContext db,
    IMongoContext mongo,
    IClientLinkAuthorizationService linkAuthorizationService)
    : Endpoint<ListNotesRequest, ListNotesResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/clients/{ClientId}/notes");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "List trainer notes for a client";
            s.Description = "Returns paginated notes, newest first. Sets X-Total-Count header.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(ListNotesRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        // Explicitly deny Client-role callers (defense-in-depth beyond the Roles attribute)
        if (User.IsInRole(AppRoles.Client)) { await Send.ForbiddenAsync(ct); return; }

        var trainerId = Guid.Parse(userId);

        // Resolve trainer's professional profile
        var trainerProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == trainerId, ct);
        if (trainerProfile is null) { await Send.NotFoundAsync(ct); return; }

        // Resolve client by PublicId
        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.PublicId == req.ClientId, ct);
        if (clientProfile is null) { await Send.NotFoundAsync(ct); return; }

        // Ownership check: trainer must have an active link with the client. The professional
        // and client profiles are already confirmed to exist above, so a null result here can
        // only mean "no active link" — not "no professional/client profile". No capability flag
        // is required, matching the pre-migration IsActive-only presence check.
        var capabilities = await linkAuthorizationService.GetCapabilitiesByClientPublicIdAsync(
            trainerId, req.ClientId, ct);
        if (capabilities is null) { await Send.ForbiddenAsync(ct); return; }

        var clientUserId = clientProfile.UserId;

        // Count total matching notes for pagination header
        var totalCount = await mongo.TrainerNotes.CountDocumentsAsync(
            Builders<Domain.Documents.TrainerNote>.Filter.And(
                Builders<Domain.Documents.TrainerNote>.Filter.Eq(n => n.ClientId, clientUserId),
                Builders<Domain.Documents.TrainerNote>.Filter.Eq(n => n.TrainerId, trainerId)),
            cancellationToken: ct);

        HttpContext.Response.Headers["X-Total-Count"] = totalCount.ToString();

        // Fetch paginated notes ordered newest-first
        var notes = await mongo.TrainerNotes
            .Find(Builders<Domain.Documents.TrainerNote>.Filter.And(
                Builders<Domain.Documents.TrainerNote>.Filter.Eq(n => n.ClientId, clientUserId),
                Builders<Domain.Documents.TrainerNote>.Filter.Eq(n => n.TrainerId, trainerId)))
            .SortByDescending(n => n.CreatedAt)
            .Skip((req.Page - 1) * req.PageSize)
            .Limit(req.PageSize)
            .ToListAsync(ct);

        await Send.OkAsync(new ListNotesResponse
        {
            Notes = notes.Select(n => new NoteDto
            {
                NoteId = n.ExternalId,
                Text = n.Text,
                CreatedAt = n.CreatedAt,
                UpdatedAt = n.UpdatedAt
            }).ToList()
        }, ct);
    }
}

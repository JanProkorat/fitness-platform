using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Trainers.ClientNotes.DeleteNote;

/// <summary>
/// Deletes a trainer note. Only the authoring trainer may delete.
/// </summary>
public class DeleteNoteEndpoint(
    IApplicationDbContext db,
    IMongoContext mongo,
    IClientLinkAuthorizationService linkAuthorizationService)
    : Endpoint<DeleteNoteRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/trainer/clients/{ClientId}/notes/{NoteId}");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Delete a trainer note";
            s.Description = "Permanently deletes a private trainer note. Only the authoring trainer may delete.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteNoteRequest req, CancellationToken ct)
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

        // Delete — filter by externalId + trainerId + clientId to prevent cross-trainer delete
        var deleteFilter = Builders<Domain.Documents.TrainerNote>.Filter.And(
            Builders<Domain.Documents.TrainerNote>.Filter.Eq(n => n.ExternalId, req.NoteId),
            Builders<Domain.Documents.TrainerNote>.Filter.Eq(n => n.TrainerId, trainerId),
            Builders<Domain.Documents.TrainerNote>.Filter.Eq(n => n.ClientId, clientProfile.UserId));

        var result = await mongo.TrainerNotes.DeleteOneAsync(deleteFilter, cancellationToken: ct);

        if (result.DeletedCount == 0)
        {
            await this.SendProblemAsync(404, ErrorCodes.TrainerNoteNotFound, "Note not found.", ct);
            return;
        }

        await Send.NoContentAsync(ct);
    }
}

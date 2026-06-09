using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Trainers.ClientNotes.EditNote;

/// <summary>
/// Edits the text of an existing trainer note. Only the authoring trainer may edit.
/// </summary>
public class EditNoteEndpoint(IApplicationDbContext db, IMongoContext mongo)
    : Endpoint<EditNoteRequest, EditNoteResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Patch("/trainer/clients/{ClientId}/notes/{NoteId}");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Edit a trainer note";
            s.Description = "Updates the text of a private trainer note. Only the authoring trainer may edit.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(EditNoteRequest req, CancellationToken ct)
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

        // Ownership check: trainer must have an active link with the client
        var hasLink = await db.ClientProfessionalLinks
            .AsNoTracking()
            .AnyAsync(l => l.ProfessionalProfileId == trainerProfile.Id
                        && l.ClientProfileId == clientProfile.Id
                        && l.IsActive, ct);
        if (!hasLink) { await Send.ForbiddenAsync(ct); return; }

        // Find the note — must belong to this trainer and this client
        var noteFilter = Builders<Domain.Documents.TrainerNote>.Filter.And(
            Builders<Domain.Documents.TrainerNote>.Filter.Eq(n => n.ExternalId, req.NoteId),
            Builders<Domain.Documents.TrainerNote>.Filter.Eq(n => n.TrainerId, trainerId),
            Builders<Domain.Documents.TrainerNote>.Filter.Eq(n => n.ClientId, clientProfile.UserId));

        var note = await mongo.TrainerNotes.Find(noteFilter).FirstOrDefaultAsync(ct);
        if (note is null)
        {
            await this.SendProblemAsync(404, ErrorCodes.TrainerNoteNotFound, "Note not found.", ct);
            return;
        }

        var updatedAt = DateTime.UtcNow;

        var update = Builders<Domain.Documents.TrainerNote>.Update
            .Set(n => n.Text, req.Text)
            .Set(n => n.UpdatedAt, updatedAt);

        await mongo.TrainerNotes.UpdateOneAsync(
            Builders<Domain.Documents.TrainerNote>.Filter.Eq(n => n.ExternalId, req.NoteId),
            update,
            cancellationToken: ct);

        await Send.OkAsync(new EditNoteResponse
        {
            NoteId = note.ExternalId,
            Text = req.Text,
            UpdatedAt = updatedAt
        }, ct);
    }
}

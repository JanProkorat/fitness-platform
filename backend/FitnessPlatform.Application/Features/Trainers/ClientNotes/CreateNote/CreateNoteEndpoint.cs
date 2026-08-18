using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.ClientNotes.CreateNote;

/// <summary>
/// Creates a private note for a client. Only accessible to Trainers who have an active link with the client.
/// </summary>
public class CreateNoteEndpoint(
    IApplicationDbContext db,
    IMongoContext mongo,
    IClientLinkAuthorizationService linkAuthorizationService)
    : Endpoint<CreateNoteRequest, CreateNoteResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/trainer/clients/{ClientId}/notes");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Create a trainer note for a client";
            s.Description = "Creates a private note visible only to the authoring trainer.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateNoteRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        // Explicitly deny Client-role callers (defense-in-depth: the Roles attribute enforces this
        // at the HTTP layer, but this guard makes unit tests deterministic and prevents leakage
        // if the route is ever accidentally reused by a client-facing path)
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

        var now = DateTime.UtcNow;
        var note = new TrainerNote
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientProfile.UserId,
            TrainerId = trainerId,
            Text = req.Text,
            CreatedAt = now,
            UpdatedAt = now
        };

        await mongo.TrainerNotes.InsertOneAsync(note, cancellationToken: ct);

        await Send.ResponseAsync(new CreateNoteResponse
        {
            NoteId = note.ExternalId,
            CreatedAt = note.CreatedAt
        }, 201, ct);
    }
}

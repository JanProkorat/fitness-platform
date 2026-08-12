using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.ClientPlans;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientTraining.SaveSessionPhotos;

/// <summary>
/// Endpoint for saving the complete photo and note state of a training session diary entry.
/// The Photos list and Note are replaced with exactly what the client sends. Creates the
/// <see cref="SessionLog"/> document if one does not already exist for today.
///
/// <para>
/// <b>Dual-write:</b> each photo in the replacement list is also mirrored into the
/// <see cref="PlanPhoto"/> table (Category = Training, PlanType = Training, LinkId = SessionId)
/// so that unified plan-photo read paths see training session diary photos too.
/// The write is idempotent: rows are matched by BlobUrl and only inserted when they don't already exist.
/// </para>
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <param name="notifier">Realtime notifier for pushing the <c>planPhotoUploaded</c> event.</param>
/// <param name="authHelper">Link capability helper — gates the trainer-addressed broadcast.</param>
/// <param name="logger">Logger.</param>
/// <param name="blobStorage">Blob storage service — normalises each submitted BlobUrl to its
/// canonical stored form before persisting, so an echoed short-lived read URL cannot become the
/// permanently stored value (F9 follow-up).</param>
public class SaveSessionPhotosEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    ProfessionalAuthHelper authHelper,
    ILogger<SaveSessionPhotosEndpoint> logger,
    IBlobStorageService blobStorage)
    : Endpoint<SaveSessionPhotosRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/training/log/sessions/{SessionId}/photos");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Save photos / note for a training session diary entry";
            s.Description =
                "Replaces the Photos list and Note on the session log with exactly what the " +
                "client sends. Each photo may carry its own optional caption (per-photo Note). " +
                "Existing photo URLs that are re-submitted keep their original UploadedAt " +
                "timestamp; new URLs receive the current UTC time. Pass an empty Photos list " +
                "to remove all photos. Creates the log entry if it does not exist yet.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SaveSessionPhotosRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == Guid.Parse(userId), ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Canonical client id on Mongo docs is ApplicationUser.Id (#840).
        var clientId = clientProfile.UserId;

        // Resolve the client's Active training plan whose date window contains today — a client
        // may hold several sequential, non-overlapping Active plans (#780).
        var planFilter = Builders<TrainingPlan>.Filter.And(
            Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientId),
            Builders<TrainingPlan>.Filter.Eq(p => p.Status, TrainingPlanStatus.Active));

        var planCursor = await mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
        var activePlans = await planCursor.ToListAsync(ct);
        var plan = PlanWindowResolver.ResolveCurrentPlan(activePlans, p => p.StartDate, p => p.Weeks.Count, DateTime.UtcNow);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Verify the SessionId belongs to the active plan
        var session = plan.Weeks
            .SelectMany(w => w.Days)
            .SelectMany(d => d.Sessions)
            .FirstOrDefault(s => s.SessionId == req.SessionId);

        if (session is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var normalizedPhotos = await NormalizePhotoUrlsOrRespondAsync(req.Photos, ct);
        if (normalizedPhotos is null)
        {
            return;
        }

        var now = DateTime.UtcNow;
        var todayUtc = now.Date;

        // Key: one log per (client, plan, session, calendar day).
        var logFilter = Builders<SessionLog>.Filter.And(
            Builders<SessionLog>.Filter.Eq(l => l.ClientId, clientId),
            Builders<SessionLog>.Filter.Eq(l => l.PlanId, plan.ExternalId),
            Builders<SessionLog>.Filter.Eq(l => l.SessionId, req.SessionId),
            Builders<SessionLog>.Filter.Eq(l => l.LogDate, todayUtc));

        var existingCursor = await mongo.SessionLogs.FindAsync(logFilter, cancellationToken: ct);
        var existingLog = await existingCursor.FirstOrDefaultAsync(ct);

        // Build the replacement photo list, preserving UploadedAt for unchanged URLs
        // and persisting the per-photo Note caption from the request.
        var existingByUrl = (existingLog?.Photos ?? [])
            .ToDictionary(p => p.BlobUrl, p => p);

        var replacementPhotos = normalizedPhotos
            .Select(input =>
            {
                var perPhotoNote = string.IsNullOrWhiteSpace(input.Note) ? null : input.Note.Trim();
                var uploadedAt = existingByUrl.TryGetValue(input.BlobUrl, out var existing)
                    ? existing.UploadedAt
                    : now;
                return new SessionPhoto
                {
                    BlobUrl = input.BlobUrl,
                    UploadedAt = uploadedAt,
                    Note = perPhotoNote
                };
            })
            .ToList();

        // Normalise the note: null clears, whitespace-only becomes null
        var resolvedNote = req.Note is null
            ? null
            : (string.IsNullOrWhiteSpace(req.Note) ? null : req.Note.Trim());

        if (existingLog is null)
        {
            // Create a new photo-only log
            var newLog = new SessionLog
            {
                ClientId = clientId,
                PlanId = plan.ExternalId,
                SessionId = req.SessionId,
                LogDate = todayUtc,
                Photos = replacementPhotos,
                Note = resolvedNote,
                CreatedAt = now,
                UpdatedAt = now,
                Version = 1
            };

            await mongo.SessionLogs.InsertOneAsync(newLog, cancellationToken: ct);
        }
        else
        {
            // Replace Photos and Note entirely; preserve other fields.
            var updateFilter = Builders<SessionLog>.Filter.Eq(l => l.Id, existingLog.Id);
            var update = Builders<SessionLog>.Update
                .Set(l => l.Photos, replacementPhotos)
                .Set(l => l.Note, resolvedNote)
                .Set(l => l.UpdatedAt, now)
                .Inc(l => l.Version, 1);

            await mongo.SessionLogs.UpdateOneAsync(updateFilter, update, cancellationToken: ct);
        }

        // Dual-write: mirror photos into PlanPhoto table so unified read paths see training photos.
        // Returns only the newly-inserted PlanPhoto rows so we can emit events for them.
        var newPhotos = await DualWritePlanPhotosAsync(
            clientProfile,
            plan.ExternalId,
            req.SessionId,
            replacementPhotos.Select(p => (p.BlobUrl, p.Note)).ToList(),
            now,
            ct);

        // Emit planPhotoUploaded to the owning trainer for each newly-created row (best-effort).
        // Gated on the trainer's CURRENT link capability, not mere plan authorship (F6 residual):
        // plan.TrainerId is permanent, but the underlying ClientProfessionalLink is not — a
        // professional whose collaboration ended must stop receiving the client's diary photos.
        // The check is evaluated once (not per photo) and never fails the client's own write —
        // an exception here only skips the broadcast.
        var trainerHasAccess = false;
        if (plan.TrainerId != Guid.Empty)
        {
            try
            {
                trainerHasAccess = await authHelper.HasPlanAccessForClientUserAsync(
                    plan.TrainerId, clientId, requireTrainingPlanAccess: true, ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex,
                    "Failed to verify trainer {TrainerId} link capability for client {ClientId}; planPhotoUploaded events skipped",
                    plan.TrainerId, clientId);
            }
        }

        if (trainerHasAccess)
        {
            foreach (var newPhoto in newPhotos)
            {
                try
                {
                    await notifier.NotifyAsync(
                        plan.TrainerId,
                        "planphotouploaded",
                        new PlanPhotoUploadedEvent
                        {
                            PlanId = newPhoto.PlanId,
                            PhotoId = newPhoto.PublicId,
                            Category = newPhoto.Category,
                            TakenAt = newPhoto.TakenAt
                        },
                        ct);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex,
                        "Failed to emit planPhotoUploaded for photo {PhotoId} to trainer {TrainerId}",
                        newPhoto.PublicId, plan.TrainerId);
                }
            }
        }
        else if (newPhotos.Count > 0)
        {
            logger.LogWarning(
                "Could not resolve an accessible owning trainer for PlanId={PlanId}; planPhotoUploaded events skipped",
                plan.ExternalId);
        }

        await Send.NoContentAsync(ct);
    }

    /// <summary>
    /// Normalises every submitted <see cref="SessionPhotoInput.BlobUrl"/> to its canonical stored
    /// form before it reaches any Mongo/DB write — see
    /// <see cref="IBlobStorageService.NormalizeToCanonicalUrl"/>. A client may echo back the
    /// short-lived DisplayUrl issued by GetTodaySession (or, from an app build that predates the
    /// identity/presentation split, a value that used to BE the permanent BlobUrl); without this
    /// the signed query string would become the permanently stored value. Returns <c>null</c>
    /// when any submitted URL cannot be recognised as a blob storage URL — a 400 has already
    /// been written in that case.
    /// </summary>
    private async Task<List<SessionPhotoInput>?> NormalizePhotoUrlsOrRespondAsync(
        List<SessionPhotoInput> inputs, CancellationToken ct)
    {
        var normalized = new List<SessionPhotoInput>(inputs.Count);

        foreach (var input in inputs)
        {
            var canonicalBlobUrl = blobStorage.NormalizeToCanonicalUrl(input.BlobUrl);
            if (canonicalBlobUrl is null)
            {
                await this.SendProblemAsync(400, ErrorCodes.InvalidBlobUrl,
                    "Photo URL is not a recognised blob storage URL.", ct);
                return null;
            }

            normalized.Add(new SessionPhotoInput { BlobUrl = canonicalBlobUrl, Note = input.Note });
        }

        return normalized;
    }

    /// <summary>
    /// Idempotent dual-write: ensures a <see cref="PlanPhoto"/> row (Category = Training) exists in
    /// PostgreSQL for each photo in <paramref name="photos"/>. Rows are matched by <c>BlobUrl</c>
    /// so calling this twice with the same URLs does not create duplicates.
    /// For new URLs a row is inserted with <c>Description</c> set from the per-photo note.
    /// For URLs that already have a row, only <c>Description</c> and <c>DateUpdated</c> are
    /// updated when the note has changed — no other fields are touched.
    /// Does NOT remove rows that were in a previous save but are absent now.
    /// Returns the list of newly-inserted <see cref="PlanPhoto"/> rows (used for SignalR events).
    /// </summary>
    private async Task<List<PlanPhoto>> DualWritePlanPhotosAsync(
        ClientProfile clientProfile,
        Guid planExternalId,
        Guid sessionId,
        IReadOnlyList<(string BlobUrl, string? Note)> photos,
        DateTime now,
        CancellationToken ct)
    {
        if (photos.Count == 0)
            return [];

        // Load existing PlanPhoto rows for this client + plan + session (Training category).
        var existingRows = await db.PlanPhotos
            .Where(p =>
                p.ClientProfileId == clientProfile.Id &&
                p.PlanId == planExternalId &&
                p.Category == PlanPhotoCategory.Training &&
                p.LinkId == sessionId)
            .ToListAsync(ct);

        var existingByUrl = existingRows.ToDictionary(
            p => p.BlobUrl,
            p => p,
            StringComparer.OrdinalIgnoreCase);

        var callerUserId = clientProfile.UserId;
        var inserted = new List<PlanPhoto>();

        foreach (var (blobUrl, note) in photos)
        {
            if (existingByUrl.TryGetValue(blobUrl, out var existing))
            {
                // Row already exists — only update Description when it has changed.
                if (existing.Description != note)
                {
                    existing.Description = note;
                    existing.DateUpdated = now;
                }
                continue;
            }

            var photo = new PlanPhoto
            {
                PublicId = Guid.NewGuid(),
                ClientProfileId = clientProfile.Id,
                PlanId = planExternalId,
                PlanType = PlanPhotoType.Training,
                LinkId = sessionId,
                Category = PlanPhotoCategory.Training,
                BlobUrl = blobUrl,
                Description = note,
                MealLogId = null,
                TakenAt = now,
                UploadedByUserId = callerUserId,
                DateCreated = now,
                DateUpdated = now
            };
            db.PlanPhotos.Add(photo);
            inserted.Add(photo);
        }

        await db.SaveChangesAsync(ct);
        return inserted;
    }
}

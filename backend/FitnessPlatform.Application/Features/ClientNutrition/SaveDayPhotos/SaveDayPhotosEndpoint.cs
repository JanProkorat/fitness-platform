using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.ClientPlans;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.SaveDayPhotos;

/// <summary>
/// Endpoint for saving the complete photo and note state of a day diary entry with replace semantics.
/// Upserts the <see cref="DayLog"/> keyed by <c>(ClientId, PlanId, LogDate=todayUtc)</c>.
/// Creates the document if it does not already exist for today.
///
/// <para>
/// <b>Dual-write:</b> each photo in the replacement list is also mirrored into the
/// <see cref="PlanPhoto"/> table (category mapped from <see cref="DayPhotoCategory"/>)
/// so that unified plan-photo read paths see day diary photos too. Photos removed from the
/// list are also removed from <see cref="PlanPhoto"/> by BlobUrl, matching the REPLACE semantics.
/// </para>
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <param name="notifier">Realtime notifier for pushing the <c>planPhotoUploaded</c> event.</param>
/// <param name="logger">Logger.</param>
public class SaveDayPhotosEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    ILogger<SaveDayPhotosEndpoint> logger)
    : Endpoint<SaveDayPhotosRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/nutrition/log/day/photos");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Save plan-level day photos / note for today";
            s.Description =
                "Replaces the Photos list and Note on the day log with exactly what the client sends. " +
                "Each photo may carry its own optional caption (per-photo Note) and a display category " +
                "(Food / Progress / Free). Existing photo URLs that are re-submitted keep their original " +
                "UploadedAt timestamp; new URLs receive the current UTC time. Pass an empty Photos list " +
                "to remove all photos; pass null for Note to clear the day-level diary note. " +
                "Creates the log entry if it does not exist yet.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SaveDayPhotosRequest req, CancellationToken ct)
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

        var clientId = clientProfile.PublicId;

        // Resolve the client's Active nutrition plan whose date window contains today — a client
        // may hold several sequential, non-overlapping Active plans (#780).
        var planFilter = Builders<NutritionPlan>.Filter.And(
            Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId),
            Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active));

        var planCursor = await mongo.NutritionPlans.FindAsync(planFilter, cancellationToken: ct);
        var activePlans = await planCursor.ToListAsync(ct);
        var plan = PlanWindowResolver.ResolveCurrentPlan(activePlans, p => p.StartDate, p => p.Weeks.Count, DateTime.UtcNow);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var now = DateTime.UtcNow;
        var todayUtc = now.Date;
        var tomorrowUtc = todayUtc.AddDays(1);

        // Key: one log per (client, plan, calendar day).
        // Defensive OR branch: matches both modern records (LogDate == today) and any future
        // scenario where LogDate was not set correctly but CreatedAt falls within today's window.
        // DayLog is greenfield so legacy mismatches won't exist — included for parity with
        // the meal-log flow.
        var logFilter = Builders<DayLog>.Filter.And(
            Builders<DayLog>.Filter.Eq(l => l.ClientId, clientId),
            Builders<DayLog>.Filter.Eq(l => l.PlanId, plan.ExternalId),
            Builders<DayLog>.Filter.Or(
                Builders<DayLog>.Filter.Eq(l => l.LogDate, todayUtc),
                Builders<DayLog>.Filter.And(
                    Builders<DayLog>.Filter.Gte(l => l.CreatedAt, todayUtc),
                    Builders<DayLog>.Filter.Lt(l => l.CreatedAt, tomorrowUtc))));

        var existingCursor = await mongo.DayLogs.FindAsync(logFilter, cancellationToken: ct);
        var existingLog = await existingCursor.FirstOrDefaultAsync(ct);

        // Build the replacement photo list, preserving UploadedAt for unchanged URLs.
        var existingByUrl = (existingLog?.Photos ?? [])
            .ToDictionary(p => p.BlobUrl, p => p);

        var replacementPhotos = req.Photos
            .Select(input =>
            {
                var perPhotoNote = string.IsNullOrWhiteSpace(input.Note) ? null : input.Note.Trim();
                var uploadedAt = existingByUrl.TryGetValue(input.BlobUrl, out var existing)
                    ? existing.UploadedAt
                    : now;
                return new DayPhoto
                {
                    BlobUrl = input.BlobUrl,
                    UploadedAt = uploadedAt,
                    Note = perPhotoNote,
                    Category = input.Category
                };
            })
            .ToList();

        // Normalise the note: null clears, whitespace-only becomes null
        var resolvedNote = req.Note is null
            ? null
            : (string.IsNullOrWhiteSpace(req.Note) ? null : req.Note.Trim());

        if (existingLog is null)
        {
            var newLog = new DayLog
            {
                ClientId = clientId,
                PlanId = plan.ExternalId,
                LogDate = todayUtc,
                Photos = replacementPhotos,
                Note = resolvedNote,
                Version = 1,
                CreatedAt = now,
                UpdatedAt = now
            };

            await mongo.DayLogs.InsertOneAsync(newLog, cancellationToken: ct);
        }
        else
        {
            // Replace Photos and Note entirely; bump Version and UpdatedAt.
            // Also backfill LogDate to todayUtc so subsequent reads can rely on the
            // LogDate == today branch (self-heal for any edge case).
            var updateFilter = Builders<DayLog>.Filter.Eq(l => l.Id, existingLog.Id);
            var update = Builders<DayLog>.Update
                .Set(l => l.Photos, replacementPhotos)
                .Set(l => l.Note, resolvedNote)
                .Set(l => l.LogDate, todayUtc)
                .Set(l => l.UpdatedAt, now)
                .Inc(l => l.Version, 1);

            await mongo.DayLogs.UpdateOneAsync(updateFilter, update, cancellationToken: ct);
        }

        // Dual-write: sync photos into PlanPhoto table with REPLACE semantics.
        // Returns only the newly-inserted PlanPhoto rows so we can emit events for them.
        var newPhotos = await DualWritePlanPhotosAsync(
            clientProfile,
            plan.ExternalId,
            replacementPhotos.Select(p => (p.BlobUrl, p.Note, p.Category)).ToList(),
            now,
            ct);

        // Emit planPhotoUploaded to the owning nutritionist for each newly-created row (best-effort).
        if (plan.NutritionistId != Guid.Empty)
        {
            foreach (var newPhoto in newPhotos)
            {
                try
                {
                    await notifier.NotifyAsync(
                        plan.NutritionistId,
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
                        "Failed to emit planPhotoUploaded for photo {PhotoId} to nutritionist {NutritionistId}",
                        newPhoto.PublicId, plan.NutritionistId);
                }
            }
        }
        else if (newPhotos.Count > 0)
        {
            logger.LogWarning(
                "Could not resolve owning nutritionist for PlanId={PlanId}; planPhotoUploaded events skipped",
                plan.ExternalId);
        }

        await Send.NoContentAsync(ct);
    }

    /// <summary>
    /// Syncs the PlanPhoto table to match the replacement photo list for the given plan.
    /// <list type="bullet">
    ///   <item>Inserts new PlanPhoto rows for blob URLs not yet in the table, setting
    ///   <c>Description</c> from the per-photo note.</item>
    ///   <item>Updates <c>Description</c> and <c>DateUpdated</c> on existing rows when
    ///   the note has changed — no other fields are touched.</item>
    ///   <item>Deletes PlanPhoto rows whose blob URLs are no longer in the replacement list
    ///   (REPLACE semantics, matching SaveDayPhotos behaviour).</item>
    /// </list>
    /// Rows are matched by BlobUrl so the operation is idempotent.
    /// Returns the list of newly-inserted <see cref="PlanPhoto"/> rows (for SignalR events).
    /// </summary>
    private async Task<List<PlanPhoto>> DualWritePlanPhotosAsync(
        ClientProfile clientProfile,
        Guid planExternalId,
        IReadOnlyList<(string BlobUrl, string? Note, DayPhotoCategory Category)> photos,
        DateTime now,
        CancellationToken ct)
    {
        // Load all existing PlanPhoto rows for this client + plan that originated from
        // day-log writes (non-Food categories only — Food photos come from SaveMealPhotos).
        // Load as tracked entities so Description updates are picked up by SaveChanges.
        var existing = await db.PlanPhotos
            .Where(p =>
                p.ClientProfileId == clientProfile.Id &&
                p.PlanId == planExternalId &&
                p.Category != PlanPhotoCategory.Food)
            .ToListAsync(ct);

        var existingByUrl = existing.ToDictionary(p => p.BlobUrl, StringComparer.OrdinalIgnoreCase);
        var newUrlSet = photos.Select(p => p.BlobUrl).ToHashSet(StringComparer.OrdinalIgnoreCase);

        // Remove rows for blob URLs no longer in the replacement list
        foreach (var toRemove in existing.Where(p => !newUrlSet.Contains(p.BlobUrl)))
            db.PlanPhotos.Remove(toRemove);

        // Insert new rows; update Description on existing rows when it has changed.
        var callerUserId = clientProfile.UserId;
        var inserted = new List<PlanPhoto>();

        foreach (var (blobUrl, note, category) in photos)
        {
            if (existingByUrl.TryGetValue(blobUrl, out var existingRow))
            {
                // Row already exists — only update Description when it has changed.
                if (existingRow.Description != note)
                {
                    existingRow.Description = note;
                    existingRow.DateUpdated = now;
                }
                continue;
            }

            var photo = new PlanPhoto
            {
                PublicId = Guid.NewGuid(),
                ClientProfileId = clientProfile.Id,
                PlanId = planExternalId,
                // Day photos always belong to nutrition plans; training plans use a separate endpoint.
                PlanType = PlanPhotoType.Nutrition,
                LinkId = planExternalId,
                Category = MapCategory(category),
                BlobUrl = blobUrl,
                Description = note,
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

    private static PlanPhotoCategory MapCategory(DayPhotoCategory category) => category switch
    {
        DayPhotoCategory.Food     => PlanPhotoCategory.Food,
        DayPhotoCategory.Progress => PlanPhotoCategory.Body,
        DayPhotoCategory.Free     => PlanPhotoCategory.FreeForm,
        _                         => PlanPhotoCategory.FreeForm,
    };
}

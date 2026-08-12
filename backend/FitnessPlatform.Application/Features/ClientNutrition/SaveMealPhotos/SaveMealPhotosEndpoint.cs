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

namespace FitnessPlatform.Application.Features.ClientNutrition.SaveMealPhotos;

/// <summary>
/// Endpoint for saving the complete photo and note state of a meal diary entry without
/// changing the meal's eaten state. The Photos list and Note are replaced with exactly
/// what the client sends. Creates the <see cref="MealLog"/> document if one does not
/// already exist for today.
///
/// <para>
/// <b>Dual-write:</b> each photo in the replacement list is also mirrored into the
/// <see cref="PlanPhoto"/> table (Category = Food) so that unified plan-photo read paths
/// (GET /client/plans/{planId}/photos) see meal diary photos too. The write is idempotent:
/// rows are matched by BlobUrl and only inserted when they don't already exist.
/// </para>
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <param name="notifier">Realtime notifier for pushing the <c>planPhotoUploaded</c> event.</param>
/// <param name="authHelper">Link capability helper — gates the nutritionist-addressed broadcast.</param>
/// <param name="logger">Logger.</param>
/// <param name="blobStorage">Blob storage service — normalises each submitted BlobUrl to its
/// canonical stored form before persisting, so an echoed short-lived read URL cannot become the
/// permanently stored value (F9 follow-up).</param>
public class SaveMealPhotosEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    ProfessionalAuthHelper authHelper,
    ILogger<SaveMealPhotosEndpoint> logger,
    IBlobStorageService blobStorage)
    : Endpoint<SaveMealPhotosRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/nutrition/log/meals/{MealId}/photos");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Save photos / note for a meal diary entry";
            s.Description =
                "Replaces the Photos list and Note on the meal log with exactly what the " +
                "client sends. Each photo may carry its own optional caption (per-photo Note). " +
                "Existing photo URLs that are re-submitted keep their original UploadedAt " +
                "timestamp; new URLs receive the current UTC time. Pass an empty Photos list " +
                "to remove all photos; pass null for Note to clear the meal-level diary note. " +
                "Never changes the meal's EatenAt state. Creates the log entry if it does " +
                "not exist yet.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SaveMealPhotosRequest req, CancellationToken ct)
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

        // Verify the mealId belongs to the active plan
        var meal = plan.Weeks
            .SelectMany(w => w.Days)
            .SelectMany(d => d.Meals)
            .FirstOrDefault(m => m.MealId == req.MealId);

        if (meal is null)
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

        var tomorrowUtc = todayUtc.AddDays(1);

        // Key: one log per (client, plan, meal, calendar day).
        // Matches both the modern keying (LogDate == today) and legacy records that were
        // created before the LogDate field existed and carry LogDate = default(DateTime)
        // but have EatenAt within today's window. Without the OR, legacy records cause
        // a duplicate photo-only log to be inserted alongside the existing eaten log.
        var logFilter = Builders<MealLog>.Filter.And(
            Builders<MealLog>.Filter.Eq(l => l.ClientId, clientId),
            Builders<MealLog>.Filter.Eq(l => l.PlanId, plan.ExternalId),
            Builders<MealLog>.Filter.Eq(l => l.MealId, req.MealId),
            Builders<MealLog>.Filter.Or(
                Builders<MealLog>.Filter.Eq(l => l.LogDate, todayUtc),
                Builders<MealLog>.Filter.And(
                    Builders<MealLog>.Filter.Gte(l => l.EatenAt, todayUtc),
                    Builders<MealLog>.Filter.Lt(l => l.EatenAt, tomorrowUtc))));

        var existingCursor = await mongo.MealLogs.FindAsync(logFilter, cancellationToken: ct);
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
                return new MealPhoto
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

        string mealLogId;

        if (existingLog is null)
        {
            // Create a new photo-only log; EatenAt is intentionally left null
            var newLog = new MealLog
            {
                ClientId = clientId,
                PlanId = plan.ExternalId,
                MealId = req.MealId,
                LogDate = todayUtc,
                EatenAt = null,
                FoodsEaten = meal.Foods,
                Photos = replacementPhotos,
                Note = resolvedNote
            };

            await mongo.MealLogs.InsertOneAsync(newLog, cancellationToken: ct);
            mealLogId = newLog.Id.ToString();
        }
        else
        {
            // Replace Photos and Note entirely; preserve EatenAt — this endpoint must never touch it.
            // Also backfill LogDate to todayUtc so legacy records (LogDate = default) self-heal
            // over time: once SaveMealPhotos has run, GetTodayLog will find this record via
            // the LogDate == today branch even if EatenAt becomes null later.
            var updateFilter = Builders<MealLog>.Filter.Eq(l => l.Id, existingLog.Id);
            var update = Builders<MealLog>.Update
                .Set(l => l.Photos, replacementPhotos)
                .Set(l => l.Note, resolvedNote)
                .Set(l => l.LogDate, todayUtc);

            await mongo.MealLogs.UpdateOneAsync(updateFilter, update, cancellationToken: ct);
            mealLogId = existingLog.Id.ToString();
        }

        // Dual-write: mirror photos into PlanPhoto table so unified read paths see meal photos.
        // Returns only the newly-inserted PlanPhoto rows so we can emit events for them.
        var newPhotos = await DualWritePlanPhotosAsync(
            clientProfile,
            plan.ExternalId,
            mealLogId,
            replacementPhotos.Select(p => (p.BlobUrl, p.Note)).ToList(),
            now,
            ct);

        // Emit planPhotoUploaded to the owning nutritionist for each newly-created row (best-effort).
        // Gated on the nutritionist's CURRENT link capability, not mere plan authorship (F6
        // residual): plan.NutritionistId is permanent, but the underlying ClientProfessionalLink
        // is not — a professional whose collaboration ended must stop receiving the client's
        // diary photos. The check is evaluated once (not per photo) and never fails the client's
        // own write — an exception here only skips the broadcast.
        var nutritionistHasAccess = false;
        if (plan.NutritionistId != Guid.Empty)
        {
            try
            {
                nutritionistHasAccess = await authHelper.HasPlanAccessForClientUserAsync(
                    plan.NutritionistId, clientId, requireTrainingPlanAccess: false, ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex,
                    "Failed to verify nutritionist {NutritionistId} link capability for client {ClientId}; planPhotoUploaded events skipped",
                    plan.NutritionistId, clientId);
            }
        }

        if (nutritionistHasAccess)
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
                "Could not resolve an accessible owning nutritionist for PlanId={PlanId}; planPhotoUploaded events skipped",
                plan.ExternalId);
        }

        await Send.NoContentAsync(ct);
    }

    /// <summary>
    /// Normalises every submitted <see cref="MealPhotoInput.BlobUrl"/> to its canonical stored
    /// form before it reaches any Mongo/DB write — see
    /// <see cref="IBlobStorageService.NormalizeToCanonicalUrl"/>. A client may echo back the
    /// short-lived DisplayUrl issued by GetTodayLog (or, from an app build that predates the
    /// identity/presentation split, a value that used to BE the permanent BlobUrl); without this
    /// the signed query string would become the permanently stored value. Returns <c>null</c>
    /// when any submitted URL cannot be recognised as a blob storage URL — a 400 has already
    /// been written in that case.
    /// </summary>
    private async Task<List<MealPhotoInput>?> NormalizePhotoUrlsOrRespondAsync(
        List<MealPhotoInput> inputs, CancellationToken ct)
    {
        var normalized = new List<MealPhotoInput>(inputs.Count);

        foreach (var input in inputs)
        {
            var canonicalBlobUrl = blobStorage.NormalizeToCanonicalUrl(input.BlobUrl);
            if (canonicalBlobUrl is null)
            {
                await this.SendProblemAsync(400, ErrorCodes.InvalidBlobUrl,
                    "Photo URL is not a recognised blob storage URL.", ct);
                return null;
            }

            normalized.Add(new MealPhotoInput { BlobUrl = canonicalBlobUrl, Note = input.Note });
        }

        return normalized;
    }

    /// <summary>
    /// Idempotent dual-write: ensures a <see cref="PlanPhoto"/> row (Category = Food) exists in
    /// PostgreSQL for each photo in <paramref name="photos"/>. Rows are matched by
    /// <c>BlobUrl</c> so calling this twice with the same URLs does not create duplicates.
    /// For new URLs a row is inserted with <c>Description</c> set from the per-photo note.
    /// For URLs that already have a row, only <c>Description</c> and <c>DateUpdated</c> are
    /// updated when the note has changed — no other fields are touched.
    /// Does NOT remove rows that were in a previous save but are absent now — deletion is not
    /// propagated from SaveMealPhotos to PlanPhoto because the meal-log REPLACE semantics
    /// would create false deletions if multiple save calls differ only in the photo list order.
    /// Returns the list of newly-inserted <see cref="PlanPhoto"/> rows (used for SignalR events).
    /// </summary>
    private async Task<List<PlanPhoto>> DualWritePlanPhotosAsync(
        ClientProfile clientProfile,
        Guid planExternalId,
        string mealLogId,
        IReadOnlyList<(string BlobUrl, string? Note)> photos,
        DateTime now,
        CancellationToken ct)
    {
        if (photos.Count == 0)
            return [];

        // Load existing PlanPhoto rows for this client + plan as tracked entities so we can
        // both detect duplicates and update Description on already-saved photos.
        var existingRows = await db.PlanPhotos
            .Where(p =>
                p.ClientProfileId == clientProfile.Id &&
                p.PlanId == planExternalId &&
                p.Category == PlanPhotoCategory.Food)
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
                PlanType = PlanPhotoType.Nutrition,
                LinkId = planExternalId,
                Category = PlanPhotoCategory.Food,
                BlobUrl = blobUrl,
                Description = note,
                MealLogId = mealLogId,
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

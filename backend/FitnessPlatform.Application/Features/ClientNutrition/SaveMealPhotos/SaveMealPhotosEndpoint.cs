using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.ClientNutrition.Shared;
using FitnessPlatform.Application.Features.ClientPhotos;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
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
/// <param name="linkAuthorizationService">Link capability service — gates the nutritionist-addressed broadcast.</param>
/// <param name="logger">Logger.</param>
/// <param name="blobStorage">Blob storage service — normalises each submitted BlobUrl to its
/// canonical stored form before persisting, so an echoed short-lived read URL cannot become the
/// permanently stored value (F9 follow-up).</param>
/// <param name="timeProvider">Clock abstraction (#955) — lets tests pin the "now" instant deterministically.</param>
public class SaveMealPhotosEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    IClientLinkAuthorizationService linkAuthorizationService,
    ILogger<SaveMealPhotosEndpoint> logger,
    IBlobStorageService blobStorage,
    TimeProvider timeProvider)
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
                "not exist yet. An optional date targets a past day (or today) of the active plan; " +
                "omitted means the client-local today.";
            s.Responses[StatusCodes.Status204NoContent] = "Photos saved";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid request, or the date is in the future (MEAL_LOG_DATE_IN_FUTURE)";
            s.Responses[StatusCodes.Status404NotFound] = "No active plan covers the date, or the meal is not on that day";
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

        // Resolve the client's local calendar day (#935) once. An explicit req.Date targets that
        // day instead (today or past); targetDayUtc anchors LogDate-style equality checks and
        // windowStartUtc/windowEndUtc anchor the legacy EatenAt instant-range filter.
        var timeZone = await db.ResolveClientTimeZoneAsync(clientId, ct);
        var localToday = ClientLocalDateResolver.ResolveLocalDate(timeProvider.GetUtcNow().UtcDateTime, timeZone);
        var targetDate = req.Date ?? localToday;

        if (targetDate > localToday)
        {
            await this.SendProblemAsync(400, ErrorCodes.MealLogDateInFuture,
                "Meal photos cannot be added to a future day.", ct);
            return;
        }

        var targetDayUtc = targetDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var (windowStartUtc, windowEndUtc) = ClientLocalDateResolver.ResolveLocalDayWindowUtc(targetDate, timeZone);

        // Without a date the legacy best-effort plan resolution applies; with one the plan
        // window must contain the date.
        var plan = req.Date is null
            ? PlanWindowResolver.ResolveCurrentPlan(activePlans, p => p.StartDate, p => p.Weeks.Count, targetDayUtc)
            : PlanWindowResolver.ResolveCurrentPlanStrict(activePlans, p => p.StartDate, p => p.Weeks.Count, targetDate);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Verify the mealId belongs to the plan — to that date's plan day when a date was given.
        var meal = req.Date is null
            ? plan.Weeks
                .SelectMany(w => w.Days)
                .SelectMany(d => d.Meals)
                .FirstOrDefault(m => m.MealId == req.MealId)
            : NutritionPlanDayResolver.FindMeal(plan, targetDayUtc, req.MealId);

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

        // Key: one log per (client, plan, meal, calendar day). The shared filter matches both the
        // modern LogDate keying and legacy records with LogDate = default but EatenAt inside the
        // day; without the OR a duplicate photo-only log would be inserted next to the eaten one.
        var logFilter = MealLogDayFilter.Build(
            clientId, plan.ExternalId, req.MealId, targetDayUtc, windowStartUtc, windowEndUtc);

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
                LogDate = targetDayUtc,
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
                .Set(l => l.LogDate, targetDayUtc);

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
            plan.NutritionistId,
            now,
            targetDate < localToday
                ? TimeZoneInfo.ConvertTimeToUtc(
                    targetDate.ToDateTime(new TimeOnly(12, 0), DateTimeKind.Unspecified), timeZone)
                : now,
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
                // plan.NutritionistId / clientId are both ApplicationUser.Id (#840) — the
                // UserId-addressed overload; the nutritionist here is the plan's permanent
                // author, not the caller.
                var capabilities = await linkAuthorizationService.GetCapabilitiesByClientUserIdAsync(
                    plan.NutritionistId, clientId, ct);
                nutritionistHasAccess = capabilities is { CanViewNutritionPlans: true };
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
        Guid planCreatorUserId,
        DateTime now,
        DateTime takenAt,
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
                TakenAt = takenAt,
                UploadedByUserId = callerUserId,
                DateCreated = now,
                DateUpdated = now
            };
            db.PlanPhotos.Add(photo);
            inserted.Add(photo);
        }

        await PlanPhotoVisibilityWriter.AddViewersAsync(db, logger, inserted, planCreatorUserId, ct);
        await db.SaveChangesAsync(ct);
        return inserted;
    }
}

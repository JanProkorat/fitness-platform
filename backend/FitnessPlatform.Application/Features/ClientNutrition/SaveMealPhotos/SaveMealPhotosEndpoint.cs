using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
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
public class SaveMealPhotosEndpoint(IMongoContext mongo, IApplicationDbContext db)
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

        var clientId = clientProfile.PublicId;

        // Resolve the client's active nutrition plan
        var planFilter = Builders<NutritionPlan>.Filter.And(
            Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId),
            Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active));

        var planCursor = await mongo.NutritionPlans.FindAsync(planFilter, cancellationToken: ct);
        var plan = await planCursor.FirstOrDefaultAsync(ct);

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

        var replacementPhotos = req.Photos
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
        await DualWritePlanPhotosAsync(
            clientProfile,
            plan.ExternalId,
            mealLogId,
            replacementPhotos.Select(p => p.BlobUrl).ToList(),
            now,
            ct);

        await Send.NoContentAsync(ct);
    }

    /// <summary>
    /// Idempotent dual-write: ensures a <see cref="PlanPhoto"/> row (Category = Food) exists in
    /// PostgreSQL for each blob URL in <paramref name="blobUrls"/>. Rows are matched by
    /// <c>BlobUrl</c> so calling this twice with the same URLs does not create duplicates.
    /// Does NOT remove rows that were in a previous save but are absent now — deletion is not
    /// propagated from SaveMealPhotos to PlanPhoto because the meal-log REPLACE semantics
    /// would create false deletions if multiple save calls differ only in the photo list order.
    /// </summary>
    private async Task DualWritePlanPhotosAsync(
        ClientProfile clientProfile,
        Guid planExternalId,
        string mealLogId,
        IReadOnlyList<string> blobUrls,
        DateTime now,
        CancellationToken ct)
    {
        if (blobUrls.Count == 0)
            return;

        // Load existing PlanPhoto rows for this client + plan to find which BlobUrls are new.
        var existingUrls = await db.PlanPhotos
            .Where(p =>
                p.ClientProfileId == clientProfile.Id &&
                p.PlanId == planExternalId &&
                p.Category == PlanPhotoCategory.Food)
            .Select(p => p.BlobUrl)
            .ToListAsync(ct);

        var existingUrlSet = existingUrls.ToHashSet(StringComparer.OrdinalIgnoreCase);

        var callerUserId = clientProfile.UserId;

        foreach (var blobUrl in blobUrls)
        {
            if (existingUrlSet.Contains(blobUrl))
                continue;

            db.PlanPhotos.Add(new PlanPhoto
            {
                PublicId = Guid.NewGuid(),
                ClientProfileId = clientProfile.Id,
                PlanId = planExternalId,
                PlanType = PlanPhotoType.Nutrition,
                LinkId = planExternalId,
                Category = PlanPhotoCategory.Food,
                BlobUrl = blobUrl,
                MealLogId = mealLogId,
                TakenAt = now,
                UploadedByUserId = callerUserId,
                DateCreated = now,
                DateUpdated = now
            });
        }

        await db.SaveChangesAsync(ct);
    }
}

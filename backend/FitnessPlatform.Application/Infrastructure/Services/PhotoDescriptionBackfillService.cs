using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// One-shot, idempotent backfill that copies per-photo notes from MongoDB
/// (<see cref="MealPhoto.Note"/> and <see cref="DayPhoto.Note"/>) into the
/// <see cref="Domain.Entities.PlanPhoto.Description"/> column in PostgreSQL.
///
/// <para>
/// Background: the dual-write helpers in <c>SaveMealPhotosEndpoint</c> and
/// <c>SaveDayPhotosEndpoint</c> had a bug that set <c>Description = null</c> for
/// all newly-inserted rows instead of copying the per-photo note.  This service
/// fixes existing rows without touching Mongo.
/// </para>
///
/// <para>
/// Safety guarantees:
/// <list type="bullet">
///   <item>Only rows with <c>Description IS NULL</c> are touched — non-null values
///     are never overwritten.</item>
///   <item>Running the method twice in a row is a no-op the second time.</item>
///   <item>Mongo collections are read-only; no Mongo mutations are made.</item>
///   <item>No schema changes or EF migrations are required.</item>
/// </list>
/// </para>
/// </summary>
public class PhotoDescriptionBackfillService(
    IApplicationDbContext db,
    IMongoContext mongo,
    ILogger<PhotoDescriptionBackfillService> logger)
{
    /// <summary>
    /// Runs both backfill passes and returns a summary of how many rows were updated.
    /// </summary>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>
    /// A tuple with the count of meal-photo rows updated and day-photo rows updated.
    /// </returns>
    public async Task<(int MealPhotosUpdated, int DayPhotosUpdated)> BackfillAsync(
        CancellationToken ct = default)
    {
        var mealCount = await BackfillMealPhotosAsync(ct);
        var dayCount  = await BackfillDayPhotosAsync(ct);
        return (mealCount, dayCount);
    }

    // ── Pass A — meal photos ─────────────────────────────────────────────────

    private async Task<int> BackfillMealPhotosAsync(CancellationToken ct)
    {
        // Load PlanPhoto rows that need backfilling:
        // Description IS NULL and MealLogId is set (these are the meal-photo dual-writes).
        var candidates = await db.PlanPhotos
            .Where(p => p.Description == null && p.MealLogId != null)
            .Select(p => new { p.Id, p.BlobUrl, p.MealLogId })
            .ToListAsync(ct);

        if (candidates.Count == 0)
        {
            logger.LogInformation("Pass A (meal photos): no candidates found, skipping");
            return 0;
        }

        logger.LogInformation(
            "Pass A (meal photos): found {Count} candidate rows to inspect",
            candidates.Count);

        // Group by MealLogId to minimise Mongo round-trips.
        var byMealLogId = candidates
            .GroupBy(p => p.MealLogId!)
            .ToDictionary(g => g.Key, g => g.ToList());

        // Build a map: planPhotoId → note (only for rows that have a non-empty note in Mongo).
        var notesToApply = new Dictionary<long, string>();

        foreach (var (mealLogIdStr, group) in byMealLogId)
        {
            if (!ObjectId.TryParse(mealLogIdStr, out var objectId))
            {
                // The MealLogId string is not a valid ObjectId — skip silently.
                continue;
            }

            var filter = Builders<MealLog>.Filter.Eq(l => l.Id, objectId);
            using var cursor = await mongo.MealLogs.FindAsync(filter, cancellationToken: ct);
            var mealLog = await cursor.FirstOrDefaultAsync(ct);

            if (mealLog is null)
                continue;

            // Index the MealLog's photos by BlobUrl for O(1) lookup.
            var mealPhotosByUrl = mealLog.Photos
                .Where(mp => !string.IsNullOrWhiteSpace(mp.Note))
                .ToDictionary(mp => mp.BlobUrl, mp => mp.Note!.Trim(),
                    StringComparer.OrdinalIgnoreCase);

            foreach (var row in group)
            {
                if (mealPhotosByUrl.TryGetValue(row.BlobUrl, out var note))
                    notesToApply[row.Id] = note;
            }
        }

        if (notesToApply.Count == 0)
        {
            logger.LogInformation("Pass A (meal photos): no non-empty notes found in Mongo, 0 rows updated");
            return 0;
        }

        // Apply the notes. Load only the rows that will actually be updated as tracked entities.
        var idsToUpdate = notesToApply.Keys.ToList();
        var rowsToUpdate = await db.PlanPhotos
            .Where(p => idsToUpdate.Contains(p.Id))
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        foreach (var row in rowsToUpdate)
        {
            if (notesToApply.TryGetValue(row.Id, out var note))
            {
                row.Description = note;
                row.DateUpdated = now;
            }
        }

        await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "Pass A (meal photos): updated {Count} rows with descriptions from Mongo",
            rowsToUpdate.Count);

        return rowsToUpdate.Count;
    }

    // ── Pass B — day photos ──────────────────────────────────────────────────

    private async Task<int> BackfillDayPhotosAsync(CancellationToken ct)
    {
        // Day-photo rows have MealLogId = null and Category != Food.
        // (Food rows without a MealLogId are edge-cases that don't exist in practice
        //  because SaveDayPhotos maps DayPhotoCategory.Food → PlanPhotoCategory.Food
        //  and SaveMealPhotos always sets MealLogId.)
        var candidates = await db.PlanPhotos
            .Where(p =>
                p.Description == null &&
                p.MealLogId == null &&
                p.Category != PlanPhotoCategory.Food)
            .Select(p => new
            {
                p.Id,
                p.BlobUrl,
                p.PlanId,
                p.ClientProfileId
            })
            .ToListAsync(ct);

        if (candidates.Count == 0)
        {
            logger.LogInformation("Pass B (day photos): no candidates found, skipping");
            return 0;
        }

        logger.LogInformation(
            "Pass B (day photos): found {Count} candidate rows to inspect",
            candidates.Count);

        // Resolve ClientProfile.PublicId (= Mongo DayLog.ClientId) for each unique ClientProfileId.
        var clientProfileIds = candidates.Select(p => p.ClientProfileId).Distinct().ToList();
        var publicIdByProfileId = await db.ClientProfiles
            .Where(cp => clientProfileIds.Contains(cp.Id))
            .Select(cp => new { cp.Id, cp.PublicId })
            .ToDictionaryAsync(cp => cp.Id, cp => cp.PublicId, ct);

        // Group by (ClientId, PlanId) to minimise Mongo round-trips.
        // Key: (clientMongoId, planExternalId).
        var grouped = candidates
            .Where(p =>
                p.PlanId.HasValue &&
                publicIdByProfileId.ContainsKey(p.ClientProfileId))
            .GroupBy(p => (
                ClientId: publicIdByProfileId[p.ClientProfileId],
                PlanId: p.PlanId!.Value))
            .ToList();

        var notesToApply = new Dictionary<long, string>();

        foreach (var group in grouped)
        {
            var (clientId, planId) = group.Key;

            // Fetch all DayLog documents for this (client, plan) pair.
            var filter = Builders<DayLog>.Filter.And(
                Builders<DayLog>.Filter.Eq(l => l.ClientId, clientId),
                Builders<DayLog>.Filter.Eq(l => l.PlanId, planId));

            using var cursor = await mongo.DayLogs.FindAsync(filter, cancellationToken: ct);
            var dayLogs = await cursor.ToListAsync(ct);

            if (dayLogs.Count == 0)
                continue;

            // Build a flat BlobUrl → Note map across all DayLog documents for this (client, plan).
            var dayPhotoNotesByUrl = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var dayLog in dayLogs)
            {
                foreach (var photo in dayLog.Photos)
                {
                    if (!string.IsNullOrWhiteSpace(photo.Note) &&
                        !dayPhotoNotesByUrl.ContainsKey(photo.BlobUrl))
                    {
                        dayPhotoNotesByUrl[photo.BlobUrl] = photo.Note.Trim();
                    }
                }
            }

            foreach (var row in group)
            {
                if (dayPhotoNotesByUrl.TryGetValue(row.BlobUrl, out var note))
                    notesToApply[row.Id] = note;
            }
        }

        if (notesToApply.Count == 0)
        {
            logger.LogInformation("Pass B (day photos): no non-empty notes found in Mongo, 0 rows updated");
            return 0;
        }

        // Load tracked entities for the rows we're about to update.
        var idsToUpdate = notesToApply.Keys.ToList();
        var rowsToUpdate = await db.PlanPhotos
            .Where(p => idsToUpdate.Contains(p.Id))
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        foreach (var row in rowsToUpdate)
        {
            if (notesToApply.TryGetValue(row.Id, out var note))
            {
                row.Description = note;
                row.DateUpdated = now;
            }
        }

        await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "Pass B (day photos): updated {Count} rows with descriptions from Mongo",
            rowsToUpdate.Count);

        return rowsToUpdate.Count;
    }
}

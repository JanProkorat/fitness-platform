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
public class SaveDayPhotosEndpoint(IMongoContext mongo, IApplicationDbContext db)
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
        await DualWritePlanPhotosAsync(
            clientProfile,
            plan.ExternalId,
            req.Photos,
            replacementPhotos,
            now,
            ct);

        await Send.NoContentAsync(ct);
    }

    /// <summary>
    /// Syncs the PlanPhoto table to match the replacement photo list for the given plan.
    /// <list type="bullet">
    ///   <item>Inserts new PlanPhoto rows for blob URLs not yet in the table.</item>
    ///   <item>Deletes PlanPhoto rows whose blob URLs are no longer in the replacement list
    ///   (REPLACE semantics, matching SaveDayPhotos behaviour).</item>
    /// </list>
    /// Rows are matched by BlobUrl so the operation is idempotent.
    /// </summary>
    private async Task DualWritePlanPhotosAsync(
        ClientProfile clientProfile,
        Guid planExternalId,
        IReadOnlyList<DayPhotoInput> inputs,
        IReadOnlyList<DayPhoto> replacementPhotos,
        DateTime now,
        CancellationToken ct)
    {
        // Load all existing PlanPhoto rows for this client + plan that originated from
        // day-log writes (non-Food categories only — Food photos come from SaveMealPhotos).
        var existing = await db.PlanPhotos
            .Where(p =>
                p.ClientProfileId == clientProfile.Id &&
                p.PlanId == planExternalId &&
                p.Category != PlanPhotoCategory.Food)
            .ToListAsync(ct);

        var existingByUrl = existing.ToDictionary(p => p.BlobUrl, StringComparer.OrdinalIgnoreCase);
        var newUrlSet = replacementPhotos.Select(p => p.BlobUrl).ToHashSet(StringComparer.OrdinalIgnoreCase);

        // Remove rows for blob URLs no longer in the replacement list
        foreach (var toRemove in existing.Where(p => !newUrlSet.Contains(p.BlobUrl)))
            db.PlanPhotos.Remove(toRemove);

        // Add new rows for blob URLs not yet tracked
        var callerUserId = clientProfile.UserId;

        foreach (var input in inputs)
        {
            if (existingByUrl.ContainsKey(input.BlobUrl))
                continue;

            db.PlanPhotos.Add(new PlanPhoto
            {
                PublicId = Guid.NewGuid(),
                ClientProfileId = clientProfile.Id,
                PlanId = planExternalId,
                PlanType = PlanPhotoType.Nutrition,
                LinkId = planExternalId,
                Category = MapCategory(input.Category),
                BlobUrl = input.BlobUrl,
                TakenAt = now,
                UploadedByUserId = callerUserId,
                DateCreated = now,
                DateUpdated = now
            });
        }

        await db.SaveChangesAsync(ct);
    }

    private static PlanPhotoCategory MapCategory(DayPhotoCategory category) => category switch
    {
        DayPhotoCategory.Food     => PlanPhotoCategory.Food,
        DayPhotoCategory.Progress => PlanPhotoCategory.Body,
        DayPhotoCategory.Free     => PlanPhotoCategory.FreeForm,
        _                         => PlanPhotoCategory.FreeForm,
    };
}

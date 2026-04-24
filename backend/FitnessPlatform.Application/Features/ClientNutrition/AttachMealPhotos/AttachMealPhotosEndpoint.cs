using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.AttachMealPhotos;

/// <summary>
/// Endpoint for attaching photos and/or a note to a meal diary entry without
/// changing the meal's eaten state. Creates the <see cref="MealLog"/> document
/// if one does not already exist for today.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
public class AttachMealPhotosEndpoint(IMongoContext mongo, IApplicationDbContext db)
    : Endpoint<AttachMealPhotosRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/nutrition/log/meals/{MealId}/photos");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Attach photos / note to a meal diary entry";
            s.Description =
                "Appends photos and/or sets a note on the meal log for today without " +
                "changing the meal's eaten state. Creates the log entry if it does not " +
                "exist yet. Idempotent with respect to EatenAt.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(AttachMealPhotosRequest req, CancellationToken ct)
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

        // Build new MealPhoto entries from the request
        var newPhotos = (req.PhotoBlobUrls ?? [])
            .Select(url => new MealPhoto { BlobUrl = url, UploadedAt = now })
            .ToList();

        // Key: one log per (client, plan, meal, calendar day)
        var logFilter = Builders<MealLog>.Filter.And(
            Builders<MealLog>.Filter.Eq(l => l.ClientId, clientId),
            Builders<MealLog>.Filter.Eq(l => l.PlanId, plan.ExternalId),
            Builders<MealLog>.Filter.Eq(l => l.MealId, req.MealId),
            Builders<MealLog>.Filter.Eq(l => l.LogDate, todayUtc));

        var existingCursor = await mongo.MealLogs.FindAsync(logFilter, cancellationToken: ct);
        var existingLog = await existingCursor.FirstOrDefaultAsync(ct);

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
                Photos = newPhotos,
                Note = req.Note is null ? null : (string.IsNullOrWhiteSpace(req.Note) ? null : req.Note.Trim())
            };

            await mongo.MealLogs.InsertOneAsync(newLog, cancellationToken: ct);
        }
        else
        {
            // Append new photos (no dedup — mirrors how photo galleries work)
            existingLog.Photos.AddRange(newPhotos);

            // Update note only when the caller supplied one
            if (req.Note is not null)
            {
                existingLog.Note = string.IsNullOrWhiteSpace(req.Note) ? null : req.Note.Trim();
            }

            // Preserve EatenAt — this endpoint must never touch it
            var updateFilter = Builders<MealLog>.Filter.Eq(l => l.Id, existingLog.Id);
            var update = Builders<MealLog>.Update
                .Set(l => l.Photos, existingLog.Photos)
                .Set(l => l.Note, existingLog.Note);

            await mongo.MealLogs.UpdateOneAsync(updateFilter, update, cancellationToken: ct);
        }

        await Send.NoContentAsync(ct);
    }
}

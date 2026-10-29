using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.LogMealEaten;

/// <summary>
/// Endpoint for logging a meal from the client's active plan as eaten.
/// Creates a <see cref="MealLog"/> document with a snapshot of the meal's foods.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <param name="notifier">Realtime notifier for pushing SignalR events.</param>
/// <param name="timeProvider">Clock abstraction (#955) — lets tests pin the "now" instant deterministically.</param>
public class LogMealEatenEndpoint(IMongoContext mongo, IApplicationDbContext db, IRealtimeNotifier notifier, TimeProvider timeProvider) : Endpoint<LogMealEatenRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/nutrition/log/meals/{MealId}/eaten");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Log a meal as eaten";
            s.Description = "Records that the client has eaten a specific meal from their active nutrition plan.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(LogMealEatenRequest req, CancellationToken ct)
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

        // Resolve the client's local calendar day (#935) — anchors plan-window resolution AND
        // the MealLog.LogDate this endpoint writes below, so a meal logged near local midnight
        // is keyed on the client's local day, not the server's UTC day.
        if (await ClientRequestDeduplicator.FindAsync(mongo, clientId, req.ClientRequestId, ct) is not null)
        {
            await HttpContext.Response.SendAsync(new { Message = "Meal logged successfully." }, 201, cancellation: ct);
            return;
        }

        // OccurredAt (offline sync) anchors the local day, plan resolution and EatenAt; without it
        // the server clock is used.
        var now = req.OccurredAt?.UtcDateTime ?? timeProvider.GetUtcNow().UtcDateTime;
        var (todayLocalUtc, windowStartUtc, windowEndUtc) = await db.ResolveClientLocalDayWindowAsync(clientId, now, ct);

        // Resolve the Active plan whose date window contains today — a client may hold several
        // sequential, non-overlapping Active plans (#780).
        var filter = Builders<NutritionPlan>.Filter.And(
            Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId),
            Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active));

        var cursor = await mongo.NutritionPlans.FindAsync(filter, cancellationToken: ct);
        var activePlans = await cursor.ToListAsync(ct);
        var plan = PlanWindowResolver.ResolveCurrentPlan(activePlans, p => p.StartDate, p => p.Weeks.Count, todayLocalUtc);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var meal = plan.Weeks
            .SelectMany(w => w.Days)
            .SelectMany(d => d.Meals)
            .FirstOrDefault(m => m.MealId == req.MealId);

        if (meal is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Same lookup as SaveMealPhotos: a photo-only row kept by an unmark (or created by a
        // photo save) is revived instead of duplicated, so one meal has one row per day.
        var existingFilter = Builders<MealLog>.Filter.And(
            Builders<MealLog>.Filter.Eq(l => l.ClientId, clientId),
            Builders<MealLog>.Filter.Eq(l => l.PlanId, plan.ExternalId),
            Builders<MealLog>.Filter.Eq(l => l.MealId, req.MealId),
            Builders<MealLog>.Filter.Or(
                Builders<MealLog>.Filter.Eq(l => l.LogDate, todayLocalUtc),
                Builders<MealLog>.Filter.And(
                    Builders<MealLog>.Filter.Gte(l => l.EatenAt, windowStartUtc),
                    Builders<MealLog>.Filter.Lt(l => l.EatenAt, windowEndUtc))));

        using var existingCursor = await mongo.MealLogs.FindAsync(existingFilter, cancellationToken: ct);
        var existingLog = await existingCursor.FirstOrDefaultAsync(ct);

        var note = string.IsNullOrWhiteSpace(req.Note) ? null : req.Note.Trim();

        if (existingLog is null)
        {
            var mealLog = new MealLog
            {
                ClientId = clientId,
                PlanId = plan.ExternalId,
                MealId = req.MealId,
                // LogDate is the CLIENT's local calendar day (#935) — todayLocalUtc, not now.Date
                // (the server's UTC day), so a meal logged near local midnight is filed under the
                // day the client's own Today card shows. EatenAt stays the true UTC instant.
                LogDate = todayLocalUtc,
                EatenAt = now,
                FoodsEaten = meal.Foods,
                Photos = (req.PhotoBlobUrls ?? [])
                    .Select(url => new MealPhoto { BlobUrl = url, UploadedAt = now })
                    .ToList(),
                Note = note,
                BasedOnPlanVersion = req.BasedOnPlanVersion
            };

            await mongo.MealLogs.InsertOneAsync(mealLog, cancellationToken: ct);
        }
        else
        {
            var knownUrls = existingLog.Photos.Select(p => p.BlobUrl).ToHashSet();
            var photos = existingLog.Photos.ToList();
            foreach (var url in req.PhotoBlobUrls ?? [])
            {
                if (knownUrls.Add(url))
                {
                    photos.Add(new MealPhoto { BlobUrl = url, UploadedAt = now });
                }
            }

            var update = Builders<MealLog>.Update
                .Set(l => l.EatenAt, now)
                .Set(l => l.LogDate, todayLocalUtc)
                .Set(l => l.FoodsEaten, meal.Foods)
                .Set(l => l.Photos, photos);

            if (note is not null)
            {
                update = update.Set(l => l.Note, note);
            }

            if (req.BasedOnPlanVersion is not null)
            {
                update = update.Set(l => l.BasedOnPlanVersion, req.BasedOnPlanVersion);
            }

            await mongo.MealLogs.UpdateOneAsync(
                Builders<MealLog>.Filter.Eq(l => l.Id, existingLog.Id), update, cancellationToken: ct);
        }

        await ClientRequestDeduplicator.RecordAsync(
            mongo, clientId, req.ClientRequestId, "LogMealEaten", req.BasedOnPlanVersion, null, timeProvider.GetUtcNow().UtcDateTime, ct);

        // The SignalR payload's ClientId is the trainer-facing ClientProfile.PublicId
        // convention (unrelated to the Mongo document clientId key migrated in #840) —
        // pass clientProfile.PublicId explicitly rather than the (now UserId-valued) clientId.
        await NotifyLinkedProfessionalsAsync(clientProfile.Id, clientProfile.PublicId, ct);

        await HttpContext.Response.SendAsync(new { Message = "Meal logged successfully." }, 201, cancellation: ct);
    }

    /// <summary>
    /// Pushes a <c>clientcomplianceupdated</c> SignalR event to every active professional
    /// (trainer/nutritionist) linked to this client so their dashboards can refresh streak
    /// and compliance without polling.
    /// </summary>
    private async Task NotifyLinkedProfessionalsAsync(long clientProfileId, Guid clientPublicId, CancellationToken ct)
    {
        var professionalUserIds = await db.ClientProfessionalLinks
            .AsNoTracking()
            .Where(l => l.ClientProfileId == clientProfileId && l.IsActive)
            .Join(db.ProfessionalProfiles.AsNoTracking(),
                link => link.ProfessionalProfileId,
                prof => prof.Id,
                (_, prof) => prof.UserId)
            .Distinct()
            .ToListAsync(ct);

        var payload = new { ClientId = clientPublicId };
        foreach (var userId in professionalUserIds)
        {
            await notifier.NotifyAsync(userId, "clientcomplianceupdated", payload, ct);
        }
    }
}

using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.GetTodayDayLog;

/// <summary>
/// Endpoint that returns the client's day-level diary log for today (plan-level photos + note).
/// Also aggregates per-meal photos from today's MealLog entries, projecting them as Food category.
/// Returns an empty photo list and null note when no day log or meal logs exist for today.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
public class GetTodayDayLogEndpoint(IMongoContext mongo, IApplicationDbContext db)
    : EndpointWithoutRequest<GetTodayDayLogResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/nutrition/log/day/today");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get today's plan-level day log";
            s.Description =
                "Returns today's day-level diary entry (plan photos and note) for the authenticated client. " +
                "Also includes per-meal photos from today's meal log entries, projected with category=Food. " +
                "Returns an empty Photos list and null Note when no entry exists yet.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
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
        var todayUtc = DateTime.UtcNow.Date;
        var tomorrowUtc = todayUtc.AddDays(1);

        // Resolve the client's active plan to scope the lookup
        var planFilter = Builders<NutritionPlan>.Filter.And(
            Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId),
            Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active));

        var planCursor = await mongo.NutritionPlans.FindAsync(planFilter, cancellationToken: ct);
        var plan = await planCursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            // No active plan — return empty response (not a 404; the gallery can still render)
            await Send.OkAsync(new GetTodayDayLogResponse(), ct);
            return;
        }

        // Fetch today's DayLog and today's MealLogs in parallel
        var dayLogFilterDef = Builders<DayLog>.Filter.And(
            Builders<DayLog>.Filter.Eq(l => l.ClientId, clientId),
            Builders<DayLog>.Filter.Eq(l => l.PlanId, plan.ExternalId),
            Builders<DayLog>.Filter.Eq(l => l.LogDate, todayUtc));

        // Legacy-defensive MealLog filter: matches modern records (LogDate == today) and
        // legacy records that were created before the LogDate field and carry EatenAt in today's window.
        var mealLogFilterDef = Builders<MealLog>.Filter.And(
            Builders<MealLog>.Filter.Eq(l => l.ClientId, clientId),
            Builders<MealLog>.Filter.Eq(l => l.PlanId, plan.ExternalId),
            Builders<MealLog>.Filter.Or(
                Builders<MealLog>.Filter.Eq(l => l.LogDate, todayUtc),
                Builders<MealLog>.Filter.And(
                    Builders<MealLog>.Filter.Gte(l => l.EatenAt, (DateTime?)todayUtc),
                    Builders<MealLog>.Filter.Lt(l => l.EatenAt, (DateTime?)tomorrowUtc))));

        var dayLogTask = mongo.DayLogs.FindAsync(dayLogFilterDef, cancellationToken: ct);
        var mealLogTask = mongo.MealLogs.FindAsync(mealLogFilterDef, cancellationToken: ct);

        var dayLogCursor = await dayLogTask;
        var mealLogCursor = await mealLogTask;

        var dayLog = await dayLogCursor.FirstOrDefaultAsync(ct);
        var mealLogs = await mealLogCursor.ToListAsync(ct);

        // Project DayLog photos (with their own category) — empty list when no DayLog exists
        var dayLogPhotos = dayLog?.Photos
            .Select(p => new DayPhotoDto
            {
                BlobUrl = p.BlobUrl,
                UploadedAt = p.UploadedAt,
                Note = p.Note,
                Category = p.Category.ToString()
            }) ?? [];

        // Project all MealLog photos as Food category
        var mealPhotos = mealLogs
            .SelectMany(ml => ml.Photos)
            .Select(p => new DayPhotoDto
            {
                BlobUrl = p.BlobUrl,
                UploadedAt = p.UploadedAt,
                Note = p.Note,
                Category = "Food"
            });

        // Combine and order by UploadedAt descending (newest first — matches mobile gallery convention)
        var allPhotos = dayLogPhotos
            .Concat(mealPhotos)
            .OrderByDescending(p => p.UploadedAt)
            .ToList();

        var response = new GetTodayDayLogResponse
        {
            Note = dayLog?.Note,
            Photos = allPhotos
        };

        await Send.OkAsync(response, ct);
    }
}

using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.ClientNutrition.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.AddOffPlanFood;

/// <summary>
/// Logs a food the client ate outside the plan today. Kcal and macros are computed here from the
/// Food document and snapshotted on the day log.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <param name="timeProvider">Clock.</param>
internal sealed class AddOffPlanFoodEndpoint(IMongoContext mongo, IApplicationDbContext db, TimeProvider timeProvider)
    : Endpoint<AddOffPlanFoodRequest, AddOffPlanFoodResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/nutrition/log/off-plan-foods");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Log a food eaten outside the plan";
            s.Description = "Adds an off-plan food entry to today's day log. Macros are computed from the food " +
                            "and the amount. Counted in GET /client/nutrition/log/today.";
            s.Responses[StatusCodes.Status200OK] = "The added entry";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid food id or amount";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status404NotFound] = "No active plan for today, or the food does not exist";
            s.Responses[StatusCodes.Status409Conflict] = "The day log changed concurrently; retry";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(AddOffPlanFoodRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientId = Guid.Parse(userId);

        var processed = await ClientRequestDeduplicator.FindAsync(mongo, clientId, req.ClientRequestId, ct);

        if (processed is not null)
        {
            var original = processed.ResultId is { } resultId
                ? await LoadEntryAsync(Builders<DayLog>.Filter.Eq(l => l.ClientId, clientId), resultId, ct)
                : null;

            if (original is null)
            {
                await Send.NotFoundAsync(ct);
                return;
            }

            await Send.OkAsync(AddOffPlanFoodResponse.FromDocument(original), ct);
            return;
        }

        var serverNowUtc = timeProvider.GetUtcNow().UtcDateTime;

        // OccurredAt (offline sync) anchors the local day, plan resolution and LoggedAt.
        var nowUtc = req.OccurredAt?.UtcDateTime ?? serverNowUtc;
        var (todayUtc, windowStartUtc, windowEndUtc) = await db.ResolveClientLocalDayWindowAsync(clientId, nowUtc, ct);

        if (req.EntryId is { } clientEntryId)
        {
            var dayFilter = TodayDayLogFilter.Build(clientId, null, todayUtc, windowStartUtc, windowEndUtc);
            var replayed = await LoadEntryAsync(dayFilter, clientEntryId, ct);

            if (replayed is not null)
            {
                await ClientRequestDeduplicator.RecordAsync(
                    mongo, clientId, req.ClientRequestId, "AddOffPlanFood", req.BasedOnPlanVersion,
                    replayed.EntryId, serverNowUtc, ct);
                await Send.OkAsync(AddOffPlanFoodResponse.FromDocument(replayed), ct);
                return;
            }
        }

        var plan = await ResolveCurrentPlanAsync(clientId, todayUtc, ct);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var food = await LoadAccessibleFoodAsync(req.FoodExternalId, plan.NutritionistId, ct);

        if (food is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var entry = BuildEntry(food, req.AmountGrams, nowUtc);
        entry.EntryId = req.EntryId ?? entry.EntryId;
        entry.BasedOnPlanVersion = req.BasedOnPlanVersion;

        var logFilter = TodayDayLogFilter.Build(clientId, plan.ExternalId, todayUtc, windowStartUtc, windowEndUtc);
        using var logCursor = await mongo.DayLogs.FindAsync(logFilter, cancellationToken: ct);
        var existingLog = await logCursor.FirstOrDefaultAsync(ct);

        if (existingLog is null)
        {
            await mongo.DayLogs.InsertOneAsync(new DayLog
            {
                ClientId = clientId,
                PlanId = plan.ExternalId,
                LogDate = todayUtc,
                OffPlanFoods = [entry],
                Version = 1,
                CreatedAt = nowUtc,
                UpdatedAt = serverNowUtc,
            }, cancellationToken: ct);
        }
        else
        {
            var versionedFilter = Builders<DayLog>.Filter.And(
                Builders<DayLog>.Filter.Eq(l => l.Id, existingLog.Id),
                Builders<DayLog>.Filter.Eq(l => l.Version, existingLog.Version));

            var update = Builders<DayLog>.Update
                .Push(l => l.OffPlanFoods, entry)
                .Set(l => l.LogDate, todayUtc)
                .Set(l => l.UpdatedAt, serverNowUtc)
                .Inc(l => l.Version, 1);

            var result = await mongo.DayLogs.UpdateOneAsync(versionedFilter, update, cancellationToken: ct);

            if (result.ModifiedCount == 0)
            {
                await this.SendProblemAsync(409, ErrorCodes.DayLogVersionConflict,
                    "The day log was modified by another request.", ct);
                return;
            }
        }

        await ClientRequestDeduplicator.RecordAsync(
            mongo, clientId, req.ClientRequestId, "AddOffPlanFood", req.BasedOnPlanVersion, entry.EntryId, serverNowUtc, ct);

        await Send.OkAsync(AddOffPlanFoodResponse.FromDocument(entry), ct);
    }

    private async Task<OffPlanFoodEntry?> LoadEntryAsync(FilterDefinition<DayLog> dayFilter, Guid entryId, CancellationToken ct)
    {
        var filter = Builders<DayLog>.Filter.And(
            dayFilter,
            Builders<DayLog>.Filter.ElemMatch(l => l.OffPlanFoods, e => e.EntryId == entryId));

        using var cursor = await mongo.DayLogs.FindAsync(filter, cancellationToken: ct);
        var log = await cursor.FirstOrDefaultAsync(ct);

        return log?.OffPlanFoods.FirstOrDefault(e => e.EntryId == entryId);
    }

    private async Task<NutritionPlan?> ResolveCurrentPlanAsync(Guid clientId, DateTime todayUtc, CancellationToken ct)
    {
        var planFilter = Builders<NutritionPlan>.Filter.And(
            Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId),
            Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active));

        using var cursor = await mongo.NutritionPlans.FindAsync(planFilter, cancellationToken: ct);
        var activePlans = await cursor.ToListAsync(ct);

        return PlanWindowResolver.ResolveCurrentPlan(activePlans, p => p.StartDate, p => p.Weeks.Count, todayUtc);
    }

    private async Task<Food?> LoadAccessibleFoodAsync(Guid foodExternalId, Guid planNutritionistId, CancellationToken ct)
    {
        using var cursor = await mongo.Foods.FindAsync(
            Builders<Food>.Filter.Eq(f => f.ExternalId, foodExternalId), cancellationToken: ct);
        var food = await cursor.FirstOrDefaultAsync(ct);

        if (food is null || food.IsDeleted)
        {
            return null;
        }

        var accessible = food.Visibility == FoodVisibility.Public || food.NutritionistId == planNutritionistId;

        return accessible ? food : null;
    }

    private static OffPlanFoodEntry BuildEntry(Food food, decimal amountGrams, DateTime nowUtc)
    {
        var ratio = amountGrams / 100m;

        return new OffPlanFoodEntry
        {
            EntryId = Guid.NewGuid(),
            FoodExternalId = food.ExternalId,
            FoodName = food.Name,
            FoodCategory = food.Category.ToString(),
            AmountGrams = amountGrams,
            Kcal = Math.Round(food.NutrientValue.Kcal * ratio, 1),
            Protein = Math.Round(food.NutrientValue.Protein * ratio, 1),
            Carbs = Math.Round(food.NutrientValue.Carbs * ratio, 1),
            Fat = Math.Round(food.NutrientValue.Fat * ratio, 1),
            Fiber = Math.Round((food.NutrientValue.Fiber ?? 0m) * ratio, 1),
            LoggedAt = nowUtc,
        };
    }
}

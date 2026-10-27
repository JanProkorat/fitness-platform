using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.ClientNutrition.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.GetWeekMealLog;

/// <summary>
/// Returns the meal log (eaten state and photos) of the plan week that contains a date, for the
/// caller's active plan.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <param name="blobStorage">Blob storage — mints short-lived read URLs for each photo.</param>
/// <param name="timeProvider">Clock.</param>
internal sealed class GetWeekMealLogEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    IBlobStorageService blobStorage,
    TimeProvider timeProvider)
    : Endpoint<GetWeekMealLogRequest, GetWeekMealLogResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/nutrition/log/week");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get the meal log of a plan week";
            s.Description =
                "Returns the plan week containing the date for the caller's active plan: per day, the meals "
                + "that have a log row with eaten state and photos (merged per meal). Future days carry no meals "
                + "and canAddPhotos=false.";
            s.Responses[StatusCodes.Status200OK] = "Week meal log";
            s.Responses[StatusCodes.Status400BadRequest] = "Date missing or invalid";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status404NotFound] = "No active plan of the caller covers the date";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetWeekMealLogRequest req, CancellationToken ct)
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

        var planFilter = Builders<NutritionPlan>.Filter.And(
            Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId),
            Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active));
        var planCursor = await mongo.NutritionPlans.FindAsync(planFilter, cancellationToken: ct);
        var activePlans = await planCursor.ToListAsync(ct);

        // Strict resolution: the legacy single-plan fallback would accept any date.
        var plan = PlanWindowResolver.ResolveCurrentPlanStrict(
            activePlans, p => p.StartDate, p => p.Weeks.Count, req.Date);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var timeZone = await db.ResolveClientTimeZoneAsync(clientId, ct);
        var localToday = ClientLocalDateResolver.ResolveLocalDate(timeProvider.GetUtcNow().UtcDateTime, timeZone);

        var planStart = DateOnly.FromDateTime(plan.StartDate!.Value);
        var weekIndex = (req.Date.DayNumber - planStart.DayNumber) / 7;
        var weekStart = planStart.AddDays(weekIndex * 7);
        var dates = Enumerable.Range(0, 7).Select(weekStart.AddDays).ToList();
        var windows = dates.ToDictionary(d => d, d => ClientLocalDateResolver.ResolveLocalDayWindowUtc(d, timeZone));

        var logFilter = MealLogDayFilter.BuildRange(
            clientId,
            plan.ExternalId,
            dates[0].ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
            dates[^1].ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
            windows[dates[0]].StartUtc,
            windows[dates[^1]].EndUtc);
        var logCursor = await mongo.MealLogs.FindAsync(logFilter, cancellationToken: ct);
        var logs = (await logCursor.ToListAsync(ct)).OrderBy(l => l.Id).ToList();

        var response = new GetWeekMealLogResponse
        {
            PlanId = plan.ExternalId,
            WeekNumber = weekIndex + 1,
            WeekStartDate = weekStart,
            WeekEndDate = dates[^1],
            Today = localToday,
        };

        foreach (var date in dates)
        {
            var dayUtc = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var (startUtc, endUtc) = windows[date];
            var day = new GetWeekMealLogDayDto { Date = date, CanAddPhotos = date <= localToday };

            if (date <= localToday)
            {
                var planMealOrder = NutritionPlanDayResolver.Resolve(plan, dayUtc)?.Meals
                    .Select((meal, index) => (meal.MealId, index))
                    .ToDictionary(x => x.MealId, x => x.index) ?? [];

                var dayLogs = logs
                    .Where(log => MealLogDayFilter.Matches(log, dayUtc, startUtc, endUtc))
                    .GroupBy(log => log.MealId)
                    .OrderBy(group => planMealOrder.GetValueOrDefault(group.Key, int.MaxValue));

                foreach (var group in dayLogs)
                {
                    day.Meals.Add(await MergeMealAsync(group.Key, group.ToList(), ct));
                }
            }

            response.Days.Add(day);
        }

        await Send.OkAsync(response, ct);
    }

    /// <summary>
    /// Merges every row of one meal on one day: eaten if any row is eaten (earliest wins), photos
    /// unioned by blob URL, note taken from the first row that has one.
    /// </summary>
    private async Task<GetWeekMealLogMealDto> MergeMealAsync(Guid mealId, List<MealLog> rows, CancellationToken ct)
    {
        var eatenAt = rows
            .Where(r => r.EatenAt.HasValue)
            .Select(r => r.EatenAt)
            .Min();

        var photos = rows
            .SelectMany(r => r.Photos)
            .GroupBy(p => p.BlobUrl)
            .Select(g => g.First())
            .OrderBy(p => p.UploadedAt)
            .ToList();

        var meal = new GetWeekMealLogMealDto
        {
            MealId = mealId,
            Eaten = eatenAt.HasValue,
            EatenAt = eatenAt,
            Note = rows.Select(r => r.Note).FirstOrDefault(note => !string.IsNullOrWhiteSpace(note)),
        };

        foreach (var photo in photos)
        {
            meal.Photos.Add(new GetWeekMealLogPhotoDto
            {
                BlobUrl = photo.BlobUrl,
                DisplayUrl = await blobStorage.GenerateReadUrlAsync(photo.BlobUrl, ct) ?? string.Empty,
                UploadedAt = photo.UploadedAt,
                Note = photo.Note,
            });
        }

        return meal;
    }
}

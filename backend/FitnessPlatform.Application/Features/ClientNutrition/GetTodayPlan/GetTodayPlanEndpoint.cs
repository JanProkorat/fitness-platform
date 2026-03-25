using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.GetTodayPlan;

/// <summary>
/// Endpoint that returns the client's active nutrition plan for the current day.
/// Cycles through plan weeks when the plan duration is exceeded.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
public class GetTodayPlanEndpoint(IMongoContext mongo, IApplicationDbContext db) : EndpointWithoutRequest<GetTodayPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/nutrition/plan/today");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get today's nutrition plan";
            s.Description = "Returns the meals and nutrition targets for the current day from the client's active plan.";
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

        var filter = Builders<Domain.Documents.NutritionPlan>.Filter.And(
            Builders<Domain.Documents.NutritionPlan>.Filter.Eq(p => p.ClientId, clientId),
            Builders<Domain.Documents.NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active));

        var cursor = await mongo.NutritionPlans.FindAsync(filter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var publishedWeeks = plan.Weeks.Where(w => w.Status == WeekStatus.Published).ToList();

        if (publishedWeeks.Count == 0)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        Domain.Documents.PlanWeek week;
        int dayIndex;

        if (plan.StartDate.HasValue)
        {
            var daysSinceStart = (int)(DateTime.UtcNow.Date - plan.StartDate.Value.Date).TotalDays;

            if (daysSinceStart < 0)
            {
                await Send.NotFoundAsync(ct);
                return;
            }

            var weekNum = daysSinceStart / 7 + 1;
            dayIndex = daysSinceStart % 7;

            week = publishedWeeks.FirstOrDefault(w => w.WeekNumber == weekNum)
                   ?? publishedWeeks[^1];
        }
        else
        {
            var daysSincePublish = (int)(DateTime.UtcNow.Date - plan.DatePublished!.Value.Date).TotalDays;

            if (daysSincePublish < 0)
            {
                await Send.NotFoundAsync(ct);
                return;
            }

            var totalDays = publishedWeeks.Count * 7;
            var currentDayIndex = daysSincePublish % totalDays;
            var weekIndex = currentDayIndex / 7;
            dayIndex = currentDayIndex % 7;

            week = publishedWeeks[weekIndex];
        }

        var day = week.Days[dayIndex];

        await Send.OkAsync(new GetTodayPlanResponse
        {
            PlanId = plan.ExternalId,
            PlanName = plan.Name,
            WeekNumber = week.WeekNumber,
            DayOfWeek = day.DayOfWeek,
            Meals = day.Meals,
            DayTotals = day.DayTotals,
            GlobalSettings = plan.GlobalSettings
        }, ct);
    }
}

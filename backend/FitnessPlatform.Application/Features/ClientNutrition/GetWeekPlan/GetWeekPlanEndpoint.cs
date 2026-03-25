using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.GetWeekPlan;

/// <summary>
/// Endpoint that returns the client's active nutrition plan for the current week.
/// Cycles through plan weeks when the plan duration is exceeded.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class GetWeekPlanEndpoint(IMongoContext mongo) : EndpointWithoutRequest<GetWeekPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/nutrition/plan/week");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get current week's nutrition plan";
            s.Description = "Returns all days and meals for the current week from the client's active plan.";
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

        var clientId = Guid.Parse(userId);

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

        if (plan.StartDate.HasValue)
        {
            var daysSinceStart = (int)(DateTime.UtcNow.Date - plan.StartDate.Value.Date).TotalDays;

            if (daysSinceStart < 0)
            {
                await Send.NotFoundAsync(ct);
                return;
            }

            var weekNum = daysSinceStart / 7 + 1;

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

            week = publishedWeeks[weekIndex];
        }

        await Send.OkAsync(new GetWeekPlanResponse
        {
            PlanId = plan.ExternalId,
            PlanName = plan.Name,
            WeekNumber = week.WeekNumber,
            Days = week.Days,
            GlobalSettings = plan.GlobalSettings
        }, ct);
    }
}

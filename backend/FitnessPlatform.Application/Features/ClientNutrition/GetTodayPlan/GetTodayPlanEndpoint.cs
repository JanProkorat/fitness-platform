using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.GetTodayPlan;

/// <summary>
/// Endpoint that returns the client's active nutrition plan for the current day.
/// Cycles through plan weeks when the plan duration is exceeded.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class GetTodayPlanEndpoint(IMongoContext mongo) : EndpointWithoutRequest<GetTodayPlanResponse>
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

        var daysSincePublish = (int)(DateTime.UtcNow.Date - plan.DatePublished!.Value.Date).TotalDays;
        var totalDays = plan.Weeks.Count * 7;
        var currentDayIndex = daysSincePublish % totalDays;
        var weekIndex = currentDayIndex / 7;
        var dayIndex = currentDayIndex % 7;

        var week = plan.Weeks[weekIndex];
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

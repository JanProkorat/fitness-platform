using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientTraining.GetTodaySession;

/// <summary>
/// Returns today's planned training session based on the client's active training plan.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class GetTodaySessionEndpoint(IMongoContext mongo) : EndpointWithoutRequest<GetTodaySessionResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/training/plan/today");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get today's training session";
            s.Description = "Returns the training session planned for today based on the active plan and week cycle.";
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

        // Find the active training plan for this client
        var filter = Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientId)
                     & Builders<TrainingPlan>.Filter.Eq(p => p.Status, TrainingPlanStatus.Active);

        using var cursor = await mongo.TrainingPlans.FindAsync(filter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null || plan.Weeks.Count == 0)
        {
            await Send.OkAsync(new GetTodaySessionResponse { HasSession = false }, ct);
            return;
        }

        // Calculate current week based on plan publish date and cycling
        var publishedWeeks = plan.Weeks
            .Where(w => w.Status == WeekStatus.Published)
            .OrderBy(w => w.WeekNumber)
            .ToList();

        if (publishedWeeks.Count == 0)
        {
            await Send.OkAsync(new GetTodaySessionResponse { HasSession = false }, ct);
            return;
        }

        // Calculate current week using StartDate if available, otherwise fall back to DatePublished
        int currentWeekNumber;
        if (plan.StartDate.HasValue)
        {
            var daysSinceStart = (int)(DateTime.UtcNow.Date - plan.StartDate.Value.Date).TotalDays;
            if (daysSinceStart < 0)
            {
                // Plan hasn't started yet
                await Send.OkAsync(new GetTodaySessionResponse { HasSession = false }, ct);
                return;
            }
            currentWeekNumber = (daysSinceStart / 7) + 1;
            // Clamp to valid range
            currentWeekNumber = Math.Max(1, Math.Min(currentWeekNumber, plan.Weeks.Count));
        }
        else
        {
            // Legacy fallback: cycle through published weeks based on first publish date
            var firstPublished = publishedWeeks.First().DatePublished ?? plan.DateCreated;
            var daysSinceStart = (int)(DateTime.UtcNow.Date - firstPublished.Date).TotalDays;
            var currentWeekIndex = (daysSinceStart / 7) % publishedWeeks.Count;
            currentWeekNumber = publishedWeeks[Math.Max(0, currentWeekIndex)].WeekNumber;
        }

        var currentWeek = plan.Weeks.FirstOrDefault(w => w.WeekNumber == currentWeekNumber);
        if (currentWeek is null || currentWeek.Status != WeekStatus.Published)
        {
            // The calculated week isn't published yet — find the nearest published week
            currentWeek = publishedWeeks.Last();
        }

        // Find today's session (1 = Monday, 7 = Sunday)
        var todayDow = (int)DateTime.UtcNow.DayOfWeek;
        todayDow = todayDow == 0 ? 7 : todayDow; // Convert Sunday from 0 to 7

        var todaySession = currentWeek.Sessions
            .Where(s => s.DayOfWeek == todayDow)
            .OrderBy(s => s.Order)
            .FirstOrDefault();

        await Send.OkAsync(new GetTodaySessionResponse
        {
            HasSession = todaySession is not null,
            PlanId = plan.ExternalId,
            PlanName = plan.Name,
            Session = todaySession,
            CurrentWeek = currentWeek.WeekNumber,
            TotalWeeks = plan.Weeks.Count
        }, ct);
    }
}

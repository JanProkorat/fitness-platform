using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientTraining.GetTodaySession;

/// <summary>
/// Returns today's planned training session based on the client's active training plan.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
public class GetTodaySessionEndpoint(IMongoContext mongo, IApplicationDbContext db) : EndpointWithoutRequest<GetTodaySessionResponse>
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

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == Guid.Parse(userId), ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var clientId = clientProfile.PublicId;

        // Find the active training plan for this client
        var filter = Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientId)
                     & Builders<TrainingPlan>.Filter.Eq(p => p.Status, TrainingPlanStatus.Active);

        using var cursor = await mongo.TrainingPlans.FindAsync(filter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            await Send.OkAsync(new GetTodaySessionResponse { HasSession = false }, ct);
            return;
        }

        // Base response: always expose plan metadata once an Active plan exists so the client
        // can preview it on the Plans screen even when there's no session for today (e.g. plan
        // not started yet, no published weeks, or today is a rest day).
        var response = new GetTodaySessionResponse
        {
            HasSession = false,
            PlanId = plan.ExternalId,
            PlanName = plan.Name,
            TotalWeeks = plan.Weeks.Count,
            Status = plan.Status.ToString(),
            QuestionnaireResponseId = plan.QuestionnaireResponseId,
            DateCompleted = plan.DateCompleted
        };

        if (plan.Weeks.Count == 0)
        {
            await Send.OkAsync(response, ct);
            return;
        }

        // Calculate current week based on plan publish date and cycling
        var publishedWeeks = plan.Weeks
            .Where(w => w.Status == WeekStatus.Published)
            .OrderBy(w => w.WeekNumber)
            .ToList();

        if (publishedWeeks.Count == 0)
        {
            await Send.OkAsync(response, ct);
            return;
        }

        // Calculate current week using StartDate if available, otherwise fall back to DatePublished
        var resolvedWeek = PlanWeekCalculator.ResolveCurrentWeekNumber(
            plan.StartDate,
            publishedWeeks.Select(w => w.WeekNumber).ToList(),
            plan.Weeks.Count,
            publishedWeeks.First().DatePublished,
            plan.DateCreated,
            DateTime.UtcNow);

        if (resolvedWeek is null)
        {
            // Plan hasn't started yet — still surface plan metadata so the client can preview it.
            await Send.OkAsync(response, ct);
            return;
        }

        int currentWeekNumber = resolvedWeek.Value;

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

        response.HasSession = todaySession is not null;
        response.Session = todaySession;
        response.CurrentWeek = currentWeek.WeekNumber;

        await Send.OkAsync(response, ct);
    }
}

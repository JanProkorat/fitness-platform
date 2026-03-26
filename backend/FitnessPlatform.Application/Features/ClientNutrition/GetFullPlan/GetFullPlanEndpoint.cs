using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.GetFullPlan;

/// <summary>
/// Endpoint that returns all published weeks of the client's active nutrition plan,
/// with pre-computed date ranges and current position within the plan.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
public class GetFullPlanEndpoint(IMongoContext mongo, IApplicationDbContext db) : EndpointWithoutRequest<GetFullPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/nutrition/plan/full");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get full nutrition plan";
            s.Description = "Returns all published weeks of the client's active nutrition plan for mobile browsing.";
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

        // Find the active nutrition plan for this client
        var filter = Builders<NutritionPlan>.Filter.And(
            Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId),
            Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active));

        var cursor = await mongo.NutritionPlans.FindAsync(filter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Collect published weeks ordered by week number
        var publishedWeeks = plan.Weeks
            .Where(w => w.Status == WeekStatus.Published)
            .OrderBy(w => w.WeekNumber)
            .ToList();

        if (publishedWeeks.Count == 0)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var today = DateTime.UtcNow.Date;

        // Determine the anchor date used for computing week start/end dates
        // Prefer StartDate; fall back to DatePublished for legacy plans
        DateTime? anchorDate = plan.StartDate ?? plan.DatePublished;

        // Determine currentWeek and currentDayOfWeek
        int? currentWeek = null;
        int? currentDayOfWeek = null;

        if (plan.StartDate.HasValue)
        {
            var daysSinceStart = (int)(today - plan.StartDate.Value.Date).TotalDays;

            if (daysSinceStart < 0)
            {
                // Plan hasn't started yet — upcoming
                currentWeek = null;
                currentDayOfWeek = null;
            }
            else
            {
                var weekNum = daysSinceStart / 7 + 1;
                var dayNum = daysSinceStart % 7 + 1;

                // Check whether the calculated week is published
                var calculatedWeek = plan.Weeks.FirstOrDefault(w => w.WeekNumber == weekNum);

                if (weekNum > publishedWeeks[^1].WeekNumber || calculatedWeek is null || calculatedWeek.Status != WeekStatus.Published)
                {
                    // Beyond published weeks or on an unpublished week — fall back to last published week
                    currentWeek = publishedWeeks[^1].WeekNumber;
                    // Use current day of week (Monday=1 … Sunday=7)
                    var dow = (int)DateTime.UtcNow.DayOfWeek;
                    currentDayOfWeek = dow == 0 ? 7 : dow;
                }
                else
                {
                    currentWeek = weekNum;
                    currentDayOfWeek = dayNum;
                }
            }
        }
        else if (plan.DatePublished.HasValue)
        {
            // Legacy: cycle through published weeks based on publish date
            var daysSincePublish = (int)(today - plan.DatePublished.Value.Date).TotalDays;
            var totalDays = publishedWeeks.Count * 7;
            var currentDayIndex = daysSincePublish % totalDays;
            var weekIndex = currentDayIndex / 7;
            var dayIndex = currentDayIndex % 7;

            currentWeek = publishedWeeks[Math.Max(0, weekIndex)].WeekNumber;
            currentDayOfWeek = dayIndex + 1;
        }

        // Build week list with pre-computed date ranges
        var fullPlanWeeks = publishedWeeks.Select(w =>
        {
            string weekStart = string.Empty;
            string weekEnd = string.Empty;

            if (anchorDate.HasValue)
            {
                // Week 1 starts on anchorDate; each subsequent week is +7 days
                var weekStartDate = anchorDate.Value.Date.AddDays((w.WeekNumber - 1) * 7);
                var weekEndDate = weekStartDate.AddDays(6);
                weekStart = weekStartDate.ToString("yyyy-MM-dd");
                weekEnd = weekEndDate.ToString("yyyy-MM-dd");
            }

            return new FullPlanWeek
            {
                WeekNumber = w.WeekNumber,
                WeekStartDate = weekStart,
                WeekEndDate = weekEnd,
                Days = w.Days
            };
        }).ToList();

        await Send.OkAsync(new GetFullPlanResponse
        {
            PlanId = plan.ExternalId,
            PlanName = plan.Name,
            StartDate = plan.StartDate,
            GlobalSettings = plan.GlobalSettings,
            Weeks = fullPlanWeeks,
            PublishedWeekCount = publishedWeeks.Count,
            TotalWeeks = plan.Weeks.Count,
            CurrentWeek = currentWeek,
            CurrentDayOfWeek = currentDayOfWeek
        }, ct);
    }
}

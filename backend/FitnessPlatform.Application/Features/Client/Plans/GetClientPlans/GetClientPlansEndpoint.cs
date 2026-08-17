using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.ClientTraining;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Client.Plans.GetClientPlans;

/// <summary>
/// Returns a list of the authenticated client's plans (nutrition + training),
/// optionally filtered by status.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
public class GetClientPlansEndpoint(IMongoContext mongo, IApplicationDbContext db)
    : Endpoint<GetClientPlansRequest, GetClientPlansResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/plans");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "List client plans";
            s.Description =
                "Returns a combined list of nutrition and training plans for the authenticated client, optionally filtered by status.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientPlansRequest req, CancellationToken ct)
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

        // Resolve the client's local calendar day (#935) — anchors current-week resolution,
        // plan-window disambiguation, and the day-of-week HasTodaySession check below on the
        // client's local "today" rather than the server's UTC day.
        var now = await db.ResolveClientLocalDateUtcAsync(clientId, ct);

        // Parse status filter
        NutritionPlanStatus? nutritionStatus = null;
        TrainingPlanStatus? trainingStatus = null;

        if (!string.IsNullOrWhiteSpace(req.Status))
        {
            if (Enum.TryParse<NutritionPlanStatus>(req.Status, ignoreCase: true, out var ns))
                nutritionStatus = ns;
            if (Enum.TryParse<TrainingPlanStatus>(req.Status, ignoreCase: true, out var ts))
                trainingStatus = ts;
        }

        var items = new List<ClientOwnPlanItem>();

        // ── Nutrition plans ──
        {
            var filter = Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId);

            if (nutritionStatus.HasValue)
            {
                filter &= Builders<NutritionPlan>.Filter.Eq(p => p.Status, nutritionStatus.Value);
            }
            else
            {
                // Exclude drafts by default
                filter &= Builders<NutritionPlan>.Filter.Ne(p => p.Status, NutritionPlanStatus.Draft);
            }

            // Only return plans that have at least one published week
            filter &= Builders<NutritionPlan>.Filter.ElemMatch(
                p => p.Weeks, w => w.Status == WeekStatus.Published);

            using var nCursor = await mongo.NutritionPlans.FindAsync(filter, cancellationToken: ct);
            var nutritionPlans = await nCursor.ToListAsync(ct);

            foreach (var plan in nutritionPlans)
            {
                var publishedWeeks = plan.Weeks
                    .Where(w => w.Status == WeekStatus.Published)
                    .OrderBy(w => w.WeekNumber)
                    .ToList();

                var publishedWeekNumbers = publishedWeeks.Select(w => w.WeekNumber).ToList();
                var currentWeek = PlanWeekCalculator.ResolveCurrentWeekNumber(
                    plan.StartDate,
                    publishedWeekNumbers,
                    plan.Weeks.Count,
                    publishedWeeks.FirstOrDefault()?.DatePublished,
                    plan.DateCreated,
                    now);

                items.Add(new ClientOwnPlanItem
                {
                    PlanId = plan.ExternalId,
                    PlanName = plan.Name,
                    Type = "nutrition",
                    Status = plan.Status.ToString(),
                    StartDate = plan.StartDate,
                    TotalWeeks = plan.Weeks.Count,
                    PublishedWeekCount = publishedWeeks.Count,
                    DateCompleted = plan.DateCompleted,
                    QuestionnaireResponseId = plan.QuestionnaireResponseId,
                    CurrentWeek = currentWeek,
                    DailyKcal = plan.GlobalSettings?.DailyKcal,
                    HasTodaySession = null // nutrition plans don't have sessions
                });
            }
        }

        // ── Training plans ──
        {
            var filter = Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientId);

            if (trainingStatus.HasValue)
            {
                filter &= Builders<TrainingPlan>.Filter.Eq(p => p.Status, trainingStatus.Value);
            }
            else
            {
                filter &= Builders<TrainingPlan>.Filter.Ne(p => p.Status, TrainingPlanStatus.Draft);
            }

            // Only return plans that have at least one published week
            filter &= Builders<TrainingPlan>.Filter.ElemMatch(
                p => p.Weeks, w => w.Status == WeekStatus.Published);

            using var tCursor = await mongo.TrainingPlans.FindAsync(filter, cancellationToken: ct);
            var trainingPlans = await tCursor.ToListAsync(ct);

            // Today's day-of-week (1 = Monday, 7 = Sunday)
            var todayDow = (int)now.DayOfWeek;
            todayDow = todayDow == 0 ? 7 : todayDow;

            // A client may hold several sequential, non-overlapping Active training plans
            // (#780). GetTodaySessionEndpoint disambiguates which ONE of them is "current" via
            // PlanWindowResolver.ResolveCurrentPlan before answering whether there's a session
            // today (#873) — this endpoint must apply the same disambiguation, or an unranged
            // Active sibling can independently claim HasTodaySession=true for a plan the
            // today-session endpoint never selected. Non-Active plans (Completed/Archived) are
            // unaffected — they carry no "current plan" concept to disambiguate.
            var activeTrainingPlans = trainingPlans.Where(p => p.Status == TrainingPlanStatus.Active).ToList();
            var currentActiveTrainingPlan = PlanWindowResolver.ResolveCurrentPlan(
                activeTrainingPlans,
                p => p.StartDate,
                p => p.Weeks.Count,
                now);

            foreach (var plan in trainingPlans)
            {
                var publishedWeeks = plan.Weeks
                    .Where(w => w.Status == WeekStatus.Published)
                    .OrderBy(w => w.WeekNumber)
                    .ToList();

                var publishedWeekNumbers = publishedWeeks.Select(w => w.WeekNumber).ToList();
                var currentWeekNumber = PlanWeekCalculator.ResolveCurrentWeekNumber(
                    plan.StartDate,
                    publishedWeekNumbers,
                    plan.Weeks.Count,
                    publishedWeeks.FirstOrDefault()?.DatePublished,
                    plan.DateCreated,
                    now);

                bool? hasTodaySession = null;
                if (currentWeekNumber.HasValue)
                {
                    var currentWeek = plan.Weeks.FirstOrDefault(w => w.WeekNumber == currentWeekNumber.Value);
                    if (currentWeek is null || currentWeek.Status != WeekStatus.Published)
                        currentWeek = publishedWeeks.Last();

                    // CurrentWeek stays informational for every plan (set below regardless of
                    // selection), but only the plan ResolveCurrentPlan selected among Active
                    // siblings may assert a live session for today.
                    var isDisambiguatedCurrentPlan = plan.Status != TrainingPlanStatus.Active
                        || (currentActiveTrainingPlan is not null && currentActiveTrainingPlan.ExternalId == plan.ExternalId);

                    hasTodaySession = isDisambiguatedCurrentPlan
                        && currentWeek.Days.Any(d => d.DayOfWeek == todayDow && d.Sessions.Count > 0);
                }

                items.Add(new ClientOwnPlanItem
                {
                    PlanId = plan.ExternalId,
                    PlanName = plan.Name,
                    Type = "training",
                    Status = plan.Status.ToString(),
                    StartDate = plan.StartDate,
                    TotalWeeks = plan.Weeks.Count,
                    PublishedWeekCount = publishedWeeks.Count,
                    DateCompleted = plan.DateCompleted,
                    QuestionnaireResponseId = plan.QuestionnaireResponseId,
                    CurrentWeek = currentWeekNumber,
                    DailyKcal = null, // training plans don't have kcal targets
                    HasTodaySession = hasTodaySession
                });
            }
        }

        // Sort by completion date descending, then creation
        items = items
            .OrderByDescending(i => i.DateCompleted ?? DateTime.MinValue)
            .ToList();

        await Send.OkAsync(new GetClientPlansResponse { Items = items }, ct);
    }
}

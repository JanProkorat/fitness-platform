using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Trainers.GetDashboardSummary;

/// <summary>
/// Returns aggregated dashboard stats for all active clients of the authenticated trainer.
/// Provides compliance, streak, workout completion, calorie data, and last activity per client.
/// </summary>
public class GetDashboardSummaryEndpoint(
    IApplicationDbContext db,
    IMongoContext mongo,
    IComplianceService complianceService)
    : EndpointWithoutRequest<GetDashboardSummaryResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/dashboard-summary");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get trainer dashboard summary";
            s.Description = "Returns per-client compliance, streak, training, calorie, and activity data for the trainer's dashboard.";
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

        var trainerUserId = Guid.Parse(userId);

        var isTrainer = User.IsInRole(AppRoles.Trainer);
        var isNutritionist = User.IsInRole(AppRoles.Nutritionist);
        var discipline = (isTrainer, isNutritionist) switch
        {
            (true, true) => ComplianceDiscipline.Both,
            (true, false) => ComplianceDiscipline.TrainingOnly,
            (false, true) => ComplianceDiscipline.NutritionOnly,
            _ => ComplianceDiscipline.Both, // admin or unexpected — fall back to combined
        };

        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(tp => tp.UserId == trainerUserId, ct);

        if (professionalProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Fetch all active client links with profiles
        var links = await db.ClientProfessionalLinks
            .AsNoTracking()
            .Where(l => l.ProfessionalProfileId == professionalProfile.Id && l.IsActive)
            .Include(l => l.ClientProfile)
            .ThenInclude(cp => cp.User)
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        var sevenDaysAgo = now.Date.AddDays(-7);

        var items = new List<ClientDashboardItem>();

        foreach (var link in links)
        {
            // ApplicationUser.Id — used for WorkoutLog queries (created by client)
            var clientUserId = link.ClientProfile.User.Id;
            // ClientProfile.PublicId — used for plans, compliance, meal logs (created by trainer)
            var clientPublicId = link.ClientProfile.PublicId;
            var clientProfileId = link.ClientProfile.Id;

            // Compliance (last 7 days) — keyed by PublicId
            var compliance = await complianceService.CalculateComplianceAsync(
                clientPublicId, sevenDaysAgo, now, ct);

            // Streak — keyed by PublicId, scoped to the viewer's discipline
            var streak = await complianceService.CalculateStreakAsync(clientPublicId, discipline, ct);

            // Average daily kcal (last 7 days) — keyed by PublicId
            var avgMacros = await complianceService.CalculateAverageMacrosAsync(
                clientPublicId, sevenDaysAgo, now, ct);

            // Today's training progress — planned vs completed for today only,
            // sourced from TrainingCompletion (same source of truth as the
            // mobile Today card and the streak calculation).
            var todayCompliance = await complianceService.CalculateComplianceAsync(
                clientPublicId, now.Date, now.Date, ct);
            var workoutsCompleted = todayCompliance.TrainingsCompleted;
            var workoutsPlanned = todayCompliance.TrainingsPlanned;

            // Active training plan — still needed for HasActiveTrainingPlan flag.
            var activePlan = await mongo.TrainingPlans
                .Find(Builders<TrainingPlan>.Filter.And(
                    Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientPublicId),
                    Builders<TrainingPlan>.Filter.Eq(p => p.Status, TrainingPlanStatus.Active)))
                .SortByDescending(p => p.DatePublished)
                .FirstOrDefaultAsync(ct);

            // Active nutrition plan — NutritionPlan.ClientId = PublicId
            var activeNutritionPlan = await mongo.NutritionPlans
                .Find(Builders<NutritionPlan>.Filter.And(
                    Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientPublicId),
                    Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active)))
                .SortByDescending(p => p.DatePublished)
                .FirstOrDefaultAsync(ct);

            // Resolve today's plan day (same week/day cycling as GetTodayPlan)
            PlanDay? todayPlanDay = null;
            if (activeNutritionPlan is not null)
            {
                var publishedWeeks = activeNutritionPlan.Weeks
                    .Where(w => w.Status == WeekStatus.Published)
                    .ToList();

                if (publishedWeeks.Count > 0)
                {
                    if (activeNutritionPlan.StartDate.HasValue)
                    {
                        var daysSinceStart = (int)(now.Date - activeNutritionPlan.StartDate.Value.Date).TotalDays;
                        if (daysSinceStart >= 0)
                        {
                            var weekNum = daysSinceStart / 7 + 1;
                            var dayIndex = daysSinceStart % 7;
                            var todayWeek = publishedWeeks.FirstOrDefault(w => w.WeekNumber == weekNum)
                                            ?? publishedWeeks[^1];
                            if (dayIndex < todayWeek.Days.Count)
                                todayPlanDay = todayWeek.Days[dayIndex];
                        }
                    }
                    else if (activeNutritionPlan.DatePublished.HasValue)
                    {
                        var daysSincePublish = (int)(now.Date - activeNutritionPlan.DatePublished.Value.Date).TotalDays;
                        if (daysSincePublish >= 0)
                        {
                            var totalDays = publishedWeeks.Count * 7;
                            var currentDayIndex = daysSincePublish % totalDays;
                            var weekIndex = currentDayIndex / 7;
                            var dayIndex = currentDayIndex % 7;
                            var todayWeek = publishedWeeks[weekIndex];
                            if (dayIndex < todayWeek.Days.Count)
                                todayPlanDay = todayWeek.Days[dayIndex];
                        }
                    }
                }
            }

            // Kcal goal: prefer globalSettings.DailyKcal, fall back to today's
            // DayTotals.Kcal — same priority as the mobile Today screen.
            var kcalGoal = activeNutritionPlan?.GlobalSettings?.DailyKcal
                           ?? todayPlanDay?.DayTotals?.Kcal;

            // Today's consumed kcal — use plan mealTotals for eaten meals
            // (includes both foods AND recipes, matching the mobile display).
            var todayStart = now.Date;
            decimal todayKcal = 0;

            if (todayPlanDay is not null)
            {
                // Get which MealIds were logged today
                var todayMealLogs = await mongo.MealLogs
                    .Find(Builders<MealLog>.Filter.And(
                        Builders<MealLog>.Filter.Eq(m => m.ClientId, clientPublicId),
                        Builders<MealLog>.Filter.Gte(m => m.EatenAt, todayStart),
                        Builders<MealLog>.Filter.Lt(m => m.EatenAt, todayStart.AddDays(1))))
                    .Project(m => m.MealId)
                    .ToListAsync(ct);

                var eatenMealIds = new HashSet<Guid>(todayMealLogs);

                // Sum mealTotals.Kcal for each eaten meal from the plan
                todayKcal = todayPlanDay.Meals
                    .Where(m => eatenMealIds.Contains(m.MealId))
                    .Sum(m => m.MealTotals?.Kcal ?? 0);
            }

            // Active nutrition plans: started, not completed/archived, has ≥1 published week
            var activeNutritionPlansCount = (int)await mongo.NutritionPlans
                .CountDocumentsAsync(
                    Builders<NutritionPlan>.Filter.And(
                        Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientPublicId),
                        Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active),
                        Builders<NutritionPlan>.Filter.Ne(p => p.StartDate, null),
                        Builders<NutritionPlan>.Filter.Lte(p => p.StartDate, now),
                        Builders<NutritionPlan>.Filter.ElemMatch(
                            p => p.Weeks,
                            Builders<PlanWeek>.Filter.Eq(w => w.Status, WeekStatus.Published))),
                    cancellationToken: ct);

            // Last activity: most recent workout or measurement
            DateTime? lastActivity = null;

            var lastWorkout = await mongo.WorkoutLogs
                .Find(Builders<WorkoutLog>.Filter.Eq(w => w.ClientId, clientUserId))
                .SortByDescending(w => w.StartedAt)
                .Project(w => w.StartedAt)
                .FirstOrDefaultAsync(ct);

            if (lastWorkout != default) lastActivity = lastWorkout;

            var lastMeasurement = await db.BodyMeasurements
                .AsNoTracking()
                .Where(m => m.ClientProfileId == clientProfileId)
                .OrderByDescending(m => m.MeasuredAt)
                .Select(m => m.MeasuredAt)
                .FirstOrDefaultAsync(ct);

            if (lastMeasurement != default && (lastActivity == null || lastMeasurement > lastActivity))
                lastActivity = lastMeasurement;

            var percentForViewer = discipline switch
            {
                ComplianceDiscipline.TrainingOnly => compliance.TrainingCompliancePercent,
                ComplianceDiscipline.NutritionOnly => compliance.NutritionCompliancePercent,
                _ => compliance.CompliancePercent,
            };

            items.Add(new ClientDashboardItem
            {
                PublicId = clientPublicId,
                FirstName = link.ClientProfile.User.FirstName,
                LastName = link.ClientProfile.User.LastName,
                Email = link.ClientProfile.User.Email!,
                AvatarBlobUrl = link.ClientProfile.User.AvatarBlobUrl,
                IsActive = link.IsActive,
                Goal = link.ClientProfile.Goals,
                CompliancePercent = percentForViewer,
                CurrentStreak = streak,
                AvgDailyKcal = avgMacros.Kcal,
                TodayKcal = todayKcal,
                KcalGoal = kcalGoal,
                WorkoutsCompleted = (int)workoutsCompleted,
                WorkoutsPlanned = workoutsPlanned,
                LastActivityAt = lastActivity,
                ActiveNutritionPlansCount = activeNutritionPlansCount,
                HasActiveTrainingPlan = activePlan is not null,
            });
        }

        await Send.OkAsync(new GetDashboardSummaryResponse { Clients = items }, ct);
    }
}

using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
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
    /// <summary>
    /// Upper bound on concurrent per-client roster tasks. Each client fans out to
    /// ~6-7 Mongo/ComplianceService calls; an unbounded Task.WhenAll over a large
    /// roster (e.g. 100 clients) would exceed the Mongo driver's default connection
    /// pool and starve co-tenant requests. Matches the bound recommended in the
    /// #660 design review.
    /// </summary>
    private const int MaxRosterConcurrency = 8;

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

        // No global-role reads here, deliberately. This endpoint derived its domain scope from
        // User.IsInRole, so adding a role to one's own account retroactively widened the figures
        // returned for every existing link — and a dual-role professional whose link was
        // deliberately narrowed to one domain still satisfied IsInRole for both. Scope is now
        // derived per link inside the per-client builder, which is also why no discipline is
        // threaded through: there is no longer a channel for role state to reach it.

        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(tp => tp.UserId == trainerUserId, ct);

        if (professionalProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Fetch all active client links with profiles.
        //
        // A link carrying NEITHER capability grants no visibility of that client, so the client is
        // omitted from the roster entirely. This is the roster analogue of the outright deny the
        // four single-client sibling routes carry — denying the whole request would be wrong here,
        // since one such link says nothing about the other clients on the roster. It also keeps
        // LinkCapabilities.Discipline's contract true for this caller: it is never asked about a
        // link that grants nothing, so its Both fallback is genuinely unreachable rather than
        // silently handing a neither-flag link the combined cross-domain figures.
        var links = await db.ClientProfessionalLinks
            .AsNoTracking()
            .Where(l => l.ProfessionalProfileId == professionalProfile.Id
                        && l.IsActive
                        && (l.CanViewNutritionPlans || l.CanViewTrainingPlans))
            .Include(l => l.ClientProfile)
            .ThenInclude(cp => cp.User)
            .ToListAsync(ct);

        if (links.Count == 0)
        {
            await Send.OkAsync(new GetDashboardSummaryResponse { Clients = [] }, ct);
            return;
        }

        var now = DateTime.UtcNow;
        var sevenDaysAgo = now.Date.AddDays(-7);

        // EF DbContext is NOT thread-safe — the last-measurement lookup is the
        // only EF call inside the original per-client loop, so it is hoisted
        // into ONE batched query here, BEFORE the parallel section below.
        // Everything the parallel tasks touch afterward (Mongo, ComplianceService)
        // is Mongo-only and safe to run concurrently — same reasoning as
        // ListClientPlansEndpoint's Task.WhenAll (#536).
        var clientProfileIds = links.Select(l => l.ClientProfile.Id).ToList();
        var lastMeasurementByProfileId = await db.BodyMeasurements
            .AsNoTracking()
            .Where(m => clientProfileIds.Contains(m.ClientProfileId))
            .GroupBy(m => m.ClientProfileId)
            .Select(g => new { ClientProfileId = g.Key, LastMeasuredAt = g.Max(m => m.MeasuredAt) })
            .ToDictionaryAsync(x => x.ClientProfileId, x => x.LastMeasuredAt, ct);

        // Parallelize the per-client roster work with a bounded degree of
        // concurrency (MaxRosterConcurrency) rather than an unbounded
        // Task.WhenAll — a large roster would otherwise fire hundreds of
        // concurrent Mongo/ComplianceService calls. Results are written into
        // an index-correlated array so response ordering matches the original
        // serial loop's roster order regardless of completion order.
        // Parallel.ForEachAsync propagates exceptions from any faulted task
        // (waits for all in-flight iterations, then re-throws), matching the
        // exception-propagation behavior of the original serial loop — no
        // ContinueWith/OnlyOnRanToCompletion swallowing.
        var items = new ClientDashboardItem[links.Count];

        await Parallel.ForEachAsync(
            links.Select((link, index) => (link, index)),
            new ParallelOptions { MaxDegreeOfParallelism = MaxRosterConcurrency, CancellationToken = ct },
            async (pair, token) =>
            {
                items[pair.index] = await BuildClientDashboardItemAsync(
                    pair.link, lastMeasurementByProfileId, now, sevenDaysAgo, token);
            });

        await Send.OkAsync(new GetDashboardSummaryResponse { Clients = items.ToList() }, ct);
    }

    /// <summary>
    /// Builds the dashboard item for a single client. Only touches Mongo and
    /// ComplianceService (both safe for concurrent use) plus the pre-batched
    /// <paramref name="lastMeasurementByProfileId"/> lookup — never the EF
    /// DbContext, so this method is safe to run concurrently across clients.
    /// </summary>
    private async Task<ClientDashboardItem> BuildClientDashboardItemAsync(
        ClientProfessionalLink link,
        IReadOnlyDictionary<long, DateTime> lastMeasurementByProfileId,
        DateTime now,
        DateTime sevenDaysAgo,
        CancellationToken ct)
    {
        // Scope comes from THIS link, per client. Two clients on the same roster can grant
        // different domains, so a single caller-level discipline could never have been correct.
        var capabilities = LinkCapabilities.FromLink(link);
        var discipline = capabilities.Discipline;

        // ApplicationUser.Id — the canonical clientId key for every Mongo document
        // (WorkoutLog, NutritionPlan, TrainingPlan, MealLog, ComplianceService) since #840.
        var clientUserId = link.ClientProfile.User.Id;
        // ClientProfile.PublicId — the trainer-facing client identifier used only in this
        // endpoint's response DTO; unrelated to the Mongo document key.
        var clientPublicId = link.ClientProfile.PublicId;
        var clientProfileId = link.ClientProfile.Id;

        // Compliance (last 7 days)
        var compliance = await complianceService.CalculateComplianceAsync(
            clientUserId, sevenDaysAgo, now, ct);

        // Streak — scoped to the viewer's discipline
        var streak = await complianceService.CalculateStreakAsync(clientUserId, discipline, ct);

        // Average daily kcal (last 7 days) — nutrition domain, so skipped outright for a link that
        // denies it rather than computed and then dropped.
        var avgMacros = capabilities.CanViewNutritionPlans
            ? await complianceService.CalculateAverageMacrosAsync(clientUserId, sevenDaysAgo, now, ct)
            : null;

        // Today's training progress — planned vs completed for today only,
        // sourced from TrainingCompletion (same source of truth as the
        // mobile Today card and the streak calculation).
        // Training domain — the planned-vs-completed pair is the trainer's programming and the
        // client's execution of it, so a nutrition-only link neither triggers the read nor sees it.
        long? workoutsCompleted = null;
        int? workoutsPlanned = null;

        if (capabilities.CanViewTrainingPlans)
        {
            var todayCompliance = await complianceService.CalculateComplianceAsync(
                clientUserId, now.Date, now.Date, ct);
            workoutsCompleted = todayCompliance.TrainingsCompleted;
            workoutsPlanned = todayCompliance.TrainingsPlanned;
        }

        // Active training plan — still needed for HasActiveTrainingPlan flag. A client may hold
        // several sequential, non-overlapping Active plans (#780); pick the one whose date
        // window contains today rather than the most recently published one.
        TrainingPlan? activePlan = null;

        if (capabilities.CanViewTrainingPlans)
        {
            var activeTrainingPlans = await mongo.TrainingPlans
                .Find(Builders<TrainingPlan>.Filter.And(
                    Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientUserId),
                    Builders<TrainingPlan>.Filter.Eq(p => p.Status, TrainingPlanStatus.Active)))
                .ToListAsync(ct);
            activePlan = PlanWindowResolver.ResolveCurrentPlan(activeTrainingPlans, p => p.StartDate, p => p.Weeks.Count, now);
        }

        // Active nutrition plan — NutritionPlan.ClientId = ApplicationUser.Id (#840). Same
        // date-window selection. Not read at all without the nutrition flag: everything derived
        // from it below (the day's calorie target, today's consumed calories) is nutrition data,
        // and its mere existence is itself a disclosure.
        NutritionPlan? activeNutritionPlan = null;

        if (capabilities.CanViewNutritionPlans)
        {
            var activeNutritionPlans = await mongo.NutritionPlans
                .Find(Builders<NutritionPlan>.Filter.And(
                    Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientUserId),
                    Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active)))
                .ToListAsync(ct);
            activeNutritionPlan = PlanWindowResolver.ResolveCurrentPlan(activeNutritionPlans, p => p.StartDate, p => p.Weeks.Count, now);
        }

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
                        // Dedupe by WeekNumber, keeping the FIRST document-order occurrence of
                        // each — matches GetTodayPlanEndpoint's legacy-branch resolution so both
                        // endpoints select the same week for a legacy plan whose weeks carry a
                        // duplicate WeekNumber. Document order is preserved deliberately — do
                        // NOT sort by weekNumber, that would silently change which week a legacy
                        // plan resolves to.
                        var distinctPublishedWeeks = publishedWeeks.DistinctBy(w => w.WeekNumber).ToList();

                        var totalDays = distinctPublishedWeeks.Count * 7;
                        var currentDayIndex = daysSincePublish % totalDays;
                        var weekIndex = currentDayIndex / 7;
                        var dayIndex = currentDayIndex % 7;
                        var todayWeek = distinctPublishedWeeks[weekIndex];
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

        // Null rather than zero for a link without the nutrition flag: zero would read as "this
        // client has eaten nothing today", which is a claim about the data rather than about
        // visibility. It stays null when there is simply no plan day too — the client's calorie
        // intake is not something this caller is being told is absent.
        // The flag test is redundant today — todayPlanDay is only ever assigned inside the
        // nutrition-gated branch above — and is kept deliberately, so that if that coupling is ever
        // broken this line still cannot emit a calorie figure to a caller who may not see one.
        decimal? todayKcal = capabilities.CanViewNutritionPlans && todayPlanDay is not null ? 0 : null;

        if (todayPlanDay is not null)
        {
            // Get which MealIds were logged today
            var todayMealLogs = await mongo.MealLogs
                .Find(Builders<MealLog>.Filter.And(
                    Builders<MealLog>.Filter.Eq(m => m.ClientId, clientUserId),
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

        // Active nutrition plans: started, not completed/archived, has ≥1 published week.
        // The count discloses that the client has a nutrition plan at all, so it follows the flag.
        int? activeNutritionPlansCount = null;

        if (capabilities.CanViewNutritionPlans)
        {
            activeNutritionPlansCount = (int)await mongo.NutritionPlans
                .CountDocumentsAsync(
                    Builders<NutritionPlan>.Filter.And(
                        Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientUserId),
                        Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active),
                        Builders<NutritionPlan>.Filter.Ne(p => p.StartDate, null),
                        Builders<NutritionPlan>.Filter.Lte(p => p.StartDate, now),
                        Builders<NutritionPlan>.Filter.ElemMatch(
                            p => p.Weeks,
                            Builders<PlanWeek>.Filter.Eq(w => w.Status, WeekStatus.Published))),
                    cancellationToken: ct);
        }

        // Last activity: most recent workout or measurement
        DateTime? lastActivity = null;

        // #841: Performance.StartedAt is the equivalent of the retired WorkoutLog.StartedAt —
        // scoped to executions that carry Performance data (checkbox-only completions never
        // appeared in the old WorkoutLogs collection either).
        var lastWorkout = await mongo.SessionExecutions
            .Find(Builders<SessionExecution>.Filter.Eq(w => w.ClientId, clientUserId)
                & Builders<SessionExecution>.Filter.Exists(w => w.Performance))
            .SortByDescending(w => w.Performance!.StartedAt)
            .Project(w => w.Performance!.StartedAt)
            .FirstOrDefaultAsync(ct);

        if (lastWorkout != default) lastActivity = lastWorkout;

        // Last measurement — resolved from the pre-batched EF lookup (no EF
        // call here; DbContext is not thread-safe across concurrent tasks).
        if (lastMeasurementByProfileId.TryGetValue(clientProfileId, out var lastMeasurement) &&
            (lastActivity == null || lastMeasurement > lastActivity))
        {
            lastActivity = lastMeasurement;
        }

        var percentForViewer = discipline switch
        {
            ComplianceDiscipline.TrainingOnly => compliance.TrainingCompliancePercent,
            ComplianceDiscipline.NutritionOnly => compliance.NutritionCompliancePercent,
            _ => compliance.CompliancePercent,
        };

        return new ClientDashboardItem
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
            AvgDailyKcal = avgMacros?.Kcal,
            TodayKcal = todayKcal,
            KcalGoal = kcalGoal,
            WorkoutsCompleted = (int?)workoutsCompleted,
            WorkoutsPlanned = workoutsPlanned,
            LastActivityAt = lastActivity,
            ActiveNutritionPlansCount = activeNutritionPlansCount,
            // Null, not false: false would assert the client has no training plan, which is a
            // claim this caller has not earned rather than an absence of visibility.
            HasActiveTrainingPlan = capabilities.CanViewTrainingPlans ? activePlan is not null : null,
        };
    }
}

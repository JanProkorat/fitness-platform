using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Trainers.ListClientPlans;

/// <summary>
/// Returns all nutrition and training plans for a specific client, across all
/// statuses (Active, Completed, Draft, Archived), sorted newest-first (by StartDate desc,
/// then DateCreated desc as tiebreaker). Includes a per-plan result summary.
///
/// Trainer must have an active ClientProfessionalLink to the client; returns 403 if not
/// linked (matches GetClientVerdict ownership pattern).
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="mongo">MongoDB context.</param>
/// <param name="complianceService">Service for calculating compliance metrics.</param>
/// <param name="audit">Audit logging service.</param>
public class ListClientPlansEndpoint(
    IApplicationDbContext db,
    IMongoContext mongo,
    IComplianceService complianceService,
    IAuditService audit)
    : Endpoint<ListClientPlansRequest, ListClientPlansResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/clients/{clientId}/plans");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "List client plans";
            s.Description = "Returns all nutrition and training plans for a client (all statuses), newest first, with per-plan result summaries.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(ListClientPlansRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerUserId = Guid.Parse(userId);

        // Locate the trainer's professional profile
        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(pp => pp.UserId == trainerUserId, ct);

        if (professionalProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Locate the client profile by PublicId
        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.PublicId == req.ClientId, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Verify an active trainer-client link exists; return 403 (not 404) when missing
        var link = await db.ClientProfessionalLinks
            .AsNoTracking()
            .FirstOrDefaultAsync(l =>
                l.ProfessionalProfileId == professionalProfile.Id &&
                l.ClientProfileId == clientProfile.Id &&
                l.IsActive, ct);

        if (link is null)
        {
            await Send.ForbiddenAsync(ct);
            return;
        }

        // A link that carries neither capability flag grants no plan visibility at all —
        // deny outright rather than returning an empty-but-200 response (matches
        // ProfessionalAuthHelper.HasAnyPlanAccessAsync semantics from #903).
        if (!link.CanViewNutritionPlans && !link.CanViewTrainingPlans)
        {
            await Send.ForbiddenAsync(ct);
            return;
        }

        // Every Mongo document's clientId (NutritionPlan, TrainingPlan, WorkoutLog,
        // PersonalRecord) is now keyed on ApplicationUser.Id (#840) — one identifier
        // serves all of them. clientProfile.Id is the long PK used by BodyMeasurement
        // (keyed on ClientProfileId), unrelated to the Mongo key.
        var clientUserId = clientProfile.UserId;
        var clientProfileId = clientProfile.Id;

        // Each domain's plans, session executions, personal records, and compliance/weight
        // computations are loaded only when the caller's link grants that domain's capability
        // flag — a nutrition-only link never queries SessionExecutions/PersonalRecords, and a
        // training-only link never queries body measurements or calls CalculateComplianceAsync.
        var (trainingItems, trainingPlans) = link.CanViewTrainingPlans
            ? await LoadTrainingItemsAsync(clientUserId, ct)
            : ([], []);

        var (nutritionItems, nutritionPlans) = link.CanViewNutritionPlans
            ? await LoadNutritionItemsAsync(clientUserId, clientProfileId, ct)
            : ([], []);

        // Merge all plans and sort newest-first:
        // Primary sort: StartDate desc (null StartDate treated as oldest — draft plans)
        // Secondary sort: DateCreated desc as tiebreaker
        var allItems = trainingItems
            .Concat(nutritionItems)
            .OrderByDescending(p => p.PeriodStart ?? DateTime.MinValue)
            .ThenByDescending(p =>
                // retrieve DateCreated from the original plan for tiebreaker
                trainingPlans.FirstOrDefault(tp => tp.ExternalId == p.PlanId)?.DateCreated
                ?? nutritionPlans.FirstOrDefault(np => np.ExternalId == p.PlanId)?.DateCreated
                ?? DateTime.MinValue)
            .ToList();

        // Audit: professional accessing a client's plan inventory, compliance percentages and
        // weight deltas. Sibling routes reading the same measurement/compliance data (e.g.
        // GetClientMeasurements) already audit; this route read the same rows without leaving
        // a trace (F11).
        await audit.LogAsync(
            trainerUserId,
            "Read",
            nameof(ClientProfile),
            clientProfile.PublicId,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            ct: ct);

        await Send.OkAsync(new ListClientPlansResponse
        {
            Plans = allItems,
            CanViewNutritionPlans = link.CanViewNutritionPlans,
            CanViewTrainingPlans = link.CanViewTrainingPlans
        }, ct);
    }

    /// <summary>
    /// Loads training plans for the client along with their per-plan result summaries
    /// (total completed trainings, PR count). Only called when the caller's link grants
    /// <c>CanViewTrainingPlans</c>.
    /// </summary>
    private async Task<(List<ClientPlanItem> Items, List<Domain.Documents.TrainingPlan> Plans)> LoadTrainingItemsAsync(
        Guid clientUserId, CancellationToken ct)
    {
        var trainingFilter = Builders<Domain.Documents.TrainingPlan>.Filter
            .Eq(p => p.ClientId, clientUserId);
        var trainingPlans = await mongo.TrainingPlans
            .Find(trainingFilter)
            .ToListAsync(ct);

        // Compute result summaries for training plans:
        // totalTrainings = count of completed SessionExecutions (with Performance) with matching PlanId
        // prCount = count of PersonalRecords with AchievedAt in [plan.StartDate .. plan.DateCompleted ?? now]
        var trainingPlanIds = trainingPlans.Select(p => p.ExternalId).ToList();
        var workoutLogs = await mongo.SessionExecutions
            .Find(Builders<Domain.Documents.SessionExecution>.Filter.And(
                Builders<Domain.Documents.SessionExecution>.Filter.Eq(l => l.ClientId, clientUserId),
                Builders<Domain.Documents.SessionExecution>.Filter.Eq(l => l.Status, Domain.Enums.SessionExecutionStatus.Completed),
                Builders<Domain.Documents.SessionExecution>.Filter.Exists(l => l.Performance),
                Builders<Domain.Documents.SessionExecution>.Filter.In(l => l.PlanId, trainingPlanIds.Cast<Guid?>())))
            .ToListAsync(ct);

        // PersonalRecords have no planId; filter by AchievedAt window per plan (computed per plan below)
        var allPersonalRecords = await mongo.PersonalRecords
            .Find(Builders<Domain.Documents.PersonalRecord>.Filter.Eq(pr => pr.ClientId, clientUserId))
            .ToListAsync(ct);

        var items = trainingPlans.Select(plan =>
        {
            var planLogCount = workoutLogs.Count(l => l.PlanId == plan.ExternalId);

            // PR window: [plan.StartDate .. plan.DateCompleted ?? now]
            int? prCount = null;
            if (plan.StartDate.HasValue)
            {
                var prWindowEnd = plan.DateCompleted ?? DateTime.UtcNow;
                prCount = allPersonalRecords.Count(pr =>
                    pr.AchievedAt >= plan.StartDate.Value &&
                    pr.AchievedAt <= prWindowEnd);
            }

            return new ClientPlanItem
            {
                PlanId = plan.ExternalId,
                PlanType = "Training",
                Name = plan.Name,
                PeriodStart = plan.StartDate,
                PeriodEnd = plan.DateCompleted,
                Status = plan.Status.ToString(),
                ResultSummary = new ClientPlanResultSummary
                {
                    TotalTrainings = planLogCount,
                    PrCount = prCount,
                    CompliancePercent = null,
                    WeightDeltaKg = null
                }
            };
        }).ToList();

        return (items, trainingPlans);
    }

    /// <summary>
    /// Loads nutrition plans for the client along with their per-plan result summaries
    /// (compliance %, weight delta). Only called when the caller's link grants
    /// <c>CanViewNutritionPlans</c> — body measurements are read here solely to feed
    /// <see cref="ClientPlanResultSummary.WeightDeltaKg"/> on nutrition plan items, so they
    /// are scoped to this domain rather than being independently gated.
    /// </summary>
    private async Task<(List<ClientPlanItem> Items, List<Domain.Documents.NutritionPlan> Plans)> LoadNutritionItemsAsync(
        Guid clientUserId, long clientProfileId, CancellationToken ct)
    {
        var nutritionFilter = Builders<Domain.Documents.NutritionPlan>.Filter
            .Eq(p => p.ClientId, clientUserId);
        var nutritionPlans = await mongo.NutritionPlans
            .Find(nutritionFilter)
            .ToListAsync(ct);

        // Body measurements keyed on clientProfile.Id (long PK)
        var allMeasurements = await db.BodyMeasurements
            .AsNoTracking()
            .Where(m => m.ClientProfileId == clientProfileId && m.WeightKg != null)
            .OrderBy(m => m.MeasuredAt)
            .ToListAsync(ct);

        // Compute compliance for all nutrition plans concurrently — IComplianceService only
        // reads from IMongoContext (IMongoCollection is thread-safe for concurrent reads);
        // it does NOT touch the EF DbContext, so Task.WhenAll is safe here.
        // Results are captured as an index-correlated array to preserve plan order.
        // Using async lambdas so faults from CalculateComplianceAsync propagate through
        // Task.WhenAll naturally, matching the exception-propagation behavior of the
        // original serial loop (no ContinueWith+OnlyOnRanToCompletion swallowing).
        var complianceTasks = nutritionPlans.Select(async plan =>
        {
            if (!plan.StartDate.HasValue)
                return ((decimal?)null, (decimal?)null);

            var periodEnd = plan.DateCompleted ?? DateTime.UtcNow;

            // Weight delta computation is pure in-memory — safe to run inside the projection.
            var startMeasurement = allMeasurements
                .FirstOrDefault(m => m.MeasuredAt >= plan.StartDate.Value && m.MeasuredAt <= periodEnd);
            var endMeasurement = allMeasurements
                .LastOrDefault(m => m.MeasuredAt >= plan.StartDate.Value && m.MeasuredAt <= periodEnd);

            decimal? weightDeltaKg = null;
            if (startMeasurement != null &&
                endMeasurement != null &&
                startMeasurement.Id != endMeasurement.Id &&
                startMeasurement.WeightKg.HasValue &&
                endMeasurement.WeightKg.HasValue)
            {
                weightDeltaKg = endMeasurement.WeightKg.Value - startMeasurement.WeightKg.Value;
            }

            var complianceResult = await complianceService.CalculateComplianceAsync(
                clientUserId, plan.StartDate.Value, periodEnd, ct);
            return ((decimal?)complianceResult.NutritionCompliancePercent, weightDeltaKg);
        }).ToList();

        var complianceResults = await Task.WhenAll(complianceTasks);

        var items = nutritionPlans
            .Select((plan, i) =>
            {
                var (compliancePercent, weightDeltaKg) = complianceResults[i];
                return new ClientPlanItem
                {
                    PlanId = plan.ExternalId,
                    PlanType = "Nutrition",
                    Name = plan.Name,
                    PeriodStart = plan.StartDate,
                    PeriodEnd = plan.DateCompleted,
                    Status = plan.Status.ToString(),
                    ResultSummary = new ClientPlanResultSummary
                    {
                        TotalTrainings = null,
                        PrCount = null,
                        CompliancePercent = compliancePercent,
                        WeightDeltaKg = weightDeltaKg
                    }
                };
            })
            .ToList();

        return (items, nutritionPlans);
    }
}

using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
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
public class ListClientPlansEndpoint(
    IApplicationDbContext db,
    IMongoContext mongo,
    IComplianceService complianceService)
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

        // clientProfile.UserId is ApplicationUser.Id (Guid) — used by all Mongo documents
        // clientProfile.Id is the long PK used by BodyMeasurement (keyed on ClientProfileId)
        var clientUserId = clientProfile.UserId;
        var clientProfileId = clientProfile.Id;

        // Load all plans from Mongo in parallel
        var nutritionFilter = Builders<Domain.Documents.NutritionPlan>.Filter
            .Eq(p => p.ClientId, clientUserId);
        var trainingFilter = Builders<Domain.Documents.TrainingPlan>.Filter
            .Eq(p => p.ClientId, clientUserId);

        var nutritionTask = mongo.NutritionPlans
            .Find(nutritionFilter)
            .ToListAsync(ct);
        var trainingTask = mongo.TrainingPlans
            .Find(trainingFilter)
            .ToListAsync(ct);

        await Task.WhenAll(nutritionTask, trainingTask);
        var nutritionPlans = nutritionTask.Result;
        var trainingPlans = trainingTask.Result;

        // Compute result summaries for training plans:
        // totalTrainings = count of completed WorkoutLogs with matching PlanId
        // prCount = count of PersonalRecords with AchievedAt in [plan.StartDate .. plan.DateCompleted ?? now]
        var trainingPlanIds = trainingPlans.Select(p => p.ExternalId).ToList();
        var workoutLogs = await mongo.WorkoutLogs
            .Find(Builders<Domain.Documents.WorkoutLog>.Filter.And(
                Builders<Domain.Documents.WorkoutLog>.Filter.Eq(l => l.ClientId, clientUserId),
                Builders<Domain.Documents.WorkoutLog>.Filter.Eq(l => l.IsCompleted, true),
                Builders<Domain.Documents.WorkoutLog>.Filter.In(l => l.PlanId, trainingPlanIds.Cast<Guid?>())))
            .ToListAsync(ct);

        // PersonalRecords have no planId; filter by AchievedAt window per plan (computed per plan below)
        var allPersonalRecords = await mongo.PersonalRecords
            .Find(Builders<Domain.Documents.PersonalRecord>.Filter.Eq(pr => pr.ClientId, clientUserId))
            .ToListAsync(ct);

        // Build training plan items
        var trainingItems = trainingPlans.Select(plan =>
        {
            var planLogCount = workoutLogs.Count(l => l.PlanId == plan.ExternalId && l.IsCompleted);

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

        // Build nutrition plan items — compute compliance and weight delta per plan
        // Body measurements keyed on clientProfile.Id (long PK)
        var allMeasurements = await db.BodyMeasurements
            .AsNoTracking()
            .Where(m => m.ClientProfileId == clientProfileId && m.WeightKg != null)
            .OrderBy(m => m.MeasuredAt)
            .ToListAsync(ct);

        var nutritionItems = new List<ClientPlanItem>();
        foreach (var plan in nutritionPlans)
        {
            decimal? compliancePercent = null;
            decimal? weightDeltaKg = null;

            if (plan.StartDate.HasValue)
            {
                var periodEnd = plan.DateCompleted ?? DateTime.UtcNow;

                // Nutrition compliance over the plan period via IComplianceService
                var complianceResult = await complianceService.CalculateComplianceAsync(
                    clientUserId,
                    plan.StartDate.Value,
                    periodEnd,
                    ct);
                compliancePercent = complianceResult.NutritionCompliancePercent;

                // Weight delta: first measurement on/after start vs last measurement on/before end
                var startMeasurement = allMeasurements
                    .FirstOrDefault(m => m.MeasuredAt >= plan.StartDate.Value && m.MeasuredAt <= periodEnd);
                var endMeasurement = allMeasurements
                    .LastOrDefault(m => m.MeasuredAt >= plan.StartDate.Value && m.MeasuredAt <= periodEnd);

                if (startMeasurement != null &&
                    endMeasurement != null &&
                    startMeasurement.Id != endMeasurement.Id &&
                    startMeasurement.WeightKg.HasValue &&
                    endMeasurement.WeightKg.HasValue)
                {
                    weightDeltaKg = endMeasurement.WeightKg.Value - startMeasurement.WeightKg.Value;
                }
            }

            nutritionItems.Add(new ClientPlanItem
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
            });
        }

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

        await Send.OkAsync(new ListClientPlansResponse { Plans = allItems }, ct);
    }
}

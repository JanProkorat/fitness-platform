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

namespace FitnessPlatform.Application.Features.Trainers.GetClientDashboard;

/// <summary>
/// Endpoint for retrieving a client's dashboard summary.
/// The requesting trainer must have an active link to the client.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="audit">Audit logging service.</param>
/// <param name="complianceService">Service for calculating compliance metrics.</param>
/// <param name="mongo">MongoDB context for reading active plan goal/macros.</param>
public class GetClientDashboardEndpoint(IApplicationDbContext db, IAuditService audit, IComplianceService complianceService, IMongoContext mongo)
    : Endpoint<GetClientDashboardRequest, GetClientDashboardResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/clients/{clientId}");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get client dashboard";
            s.Description = "Returns a summary dashboard for a specific client managed by the authenticated trainer.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientDashboardRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        // Find the trainer's profile
        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(tp => tp.UserId == Guid.Parse(userId), ct);

        if (professionalProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Find the client profile by PublicId
        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .Include(cp => cp.User)
            .Include(cp => cp.OnboardingData)
            .FirstOrDefaultAsync(cp => cp.PublicId == req.ClientId, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Verify an active trainer-client link exists
        var link = await db.ClientProfessionalLinks
            .AsNoTracking()
            .FirstOrDefaultAsync(ctl =>
                ctl.ProfessionalProfileId == professionalProfile.Id &&
                ctl.ClientProfileId == clientProfile.Id &&
                ctl.IsActive, ct);

        if (link is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // A link that carries neither capability flag grants no dashboard visibility at
        // all — deny outright (matches ProfessionalAuthHelper.HasAnyPlanAccessAsync
        // semantics from #903).
        if (!link.CanViewNutritionPlans && !link.CanViewTrainingPlans)
        {
            await Send.ForbiddenAsync(ct);
            return;
        }

        // Count body measurements and progress photos
        var totalMeasurements = await db.BodyMeasurements
            .AsNoTracking()
            .CountAsync(bm => bm.ClientProfileId == clientProfile.Id, ct);

        var totalProgressPhotos = await db.PlanPhotos
            .AsNoTracking()
            .CountAsync(pp => pp.ClientProfileId == clientProfile.Id && pp.Category == PlanPhotoCategory.Body, ct);

        // Get the latest body measurement
        var latestMeasurement = await db.BodyMeasurements
            .AsNoTracking()
            .Where(bm => bm.ClientProfileId == clientProfile.Id)
            .OrderByDescending(bm => bm.MeasuredAt)
            .Select(bm => new LatestMeasurementDto
            {
                MeasuredAt = bm.MeasuredAt,
                WeightKg = bm.WeightKg,
                BodyFatPercentage = bm.BodyFatPercentage
            })
            .FirstOrDefaultAsync(ct);

        // Calculate compliance data (last 7 days). Substitute the caller-visible value
        // into the existing wire fields rather than dropping them — a single-flag caller
        // gets their own domain's figure (CompliancePercent is the COMBINED weighted
        // figure per IComplianceService; returning it unfiltered to a single-flag caller
        // would leak the other domain's adherence by inference).
        decimal? compliancePercent = null;
        var currentStreak = 0;

        var discipline = link.CanViewNutritionPlans && link.CanViewTrainingPlans
            ? ComplianceDiscipline.Both
            : link.CanViewNutritionPlans
                ? ComplianceDiscipline.NutritionOnly
                : ComplianceDiscipline.TrainingOnly;

        try
        {
            var complianceFrom = DateTime.UtcNow.Date.AddDays(-7);
            var complianceTo = DateTime.UtcNow.Date.AddDays(1).AddTicks(-1);
            var compliance = await complianceService.CalculateComplianceAsync(
                clientProfile.UserId, complianceFrom, complianceTo, ct);
            compliancePercent = discipline switch
            {
                ComplianceDiscipline.NutritionOnly => compliance.NutritionCompliancePercent,
                ComplianceDiscipline.TrainingOnly => compliance.TrainingCompliancePercent,
                _ => compliance.CompliancePercent
            };
            currentStreak = await complianceService.CalculateStreakAsync(clientProfile.UserId, discipline, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Compliance data is optional — may fail if no active nutrition plan exists
            Logger.LogWarning(ex, "Compliance computation failed for client {ClientPublicId}; returning null compliance", clientProfile.PublicId);
        }

        // Audit: trainer accessing client health data
        await audit.LogAsync(
            Guid.Parse(userId),
            "Read",
            nameof(ClientProfile),
            clientProfile.PublicId,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            ct: ct);

        // Determine questionnaire status
        var questionnaireStatus = "none";
        string? questionnaireTitle = null;
        Guid? questionnaireResponsePublicId = null;

        var qResponse = await db.QuestionnaireResponses
            .AsNoTracking()
            .Include(r => r.Questionnaire)
            .Where(r => r.ClientId == clientProfile.UserId
                     && r.ProfessionalId == Guid.Parse(userId)
                     && r.Status != Domain.Enums.QuestionnaireResponseStatus.Cancelled)
            .OrderByDescending(r => r.DateCreated)
            .FirstOrDefaultAsync(ct);

        if (qResponse is not null)
        {
            questionnaireStatus = qResponse.Status == Domain.Enums.QuestionnaireResponseStatus.Submitted
                ? "submitted"
                : "pending";
            questionnaireTitle = qResponse.Questionnaire.Title;
            questionnaireResponsePublicId = qResponse.PublicId;
        }

        // Query the Active NutritionPlan whose date window contains today to source
        // goal + targetWeightKg plan-first. Fallback to OnboardingData only when the plan
        // value is null. Key: plan.ClientId == clientProfile.UserId — ApplicationUser.Id is
        // the canonical clientId for Mongo documents (#840). A client may hold several
        // sequential, non-overlapping Active plans (#780), so pick the one whose window
        // contains today rather than the most recent.
        //
        // Gated on CanViewNutritionPlans: a training-only caller must not trigger this
        // query at all, otherwise the plan's Goal/TargetWeightKg would win via the ??
        // fallback below and disclose the existence/values of a plan the caller has no
        // visibility into (#921).
        NutritionPlan? activePlan = null;
        if (link.CanViewNutritionPlans)
        {
            try
            {
                var planFilter = Builders<NutritionPlan>.Filter.And(
                    Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientProfile.UserId),
                    Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active));

                using var planCursor = await mongo.NutritionPlans.FindAsync(planFilter, cancellationToken: ct);
                var activePlans = await planCursor.ToListAsync(ct);
                activePlan = PlanWindowResolver.ResolveCurrentPlan(activePlans, p => p.StartDate, p => p.Weeks.Count, DateTime.UtcNow);
            }
            catch (MongoDB.Driver.MongoException ex)
            {
                // Active plan query is optional — log and fall back to onboarding if Mongo is unavailable
                Logger.LogWarning(ex, "Mongo query for active NutritionPlan failed for client {ClientPublicId}; falling back to onboarding data", clientProfile.PublicId);
            }
        }

        OnboardingDataDto? onboarding = null;
        if (clientProfile.OnboardingData is { } od)
        {
            // Plan-first: prefer plan's goal and targetWeightKg; fall back to onboarding baseline.
            var effectiveTargetWeightKg = activePlan?.TargetWeightKg ?? od.TargetWeightKg;
            var effectivePrimaryGoal = activePlan?.Goal?.ToString() ?? od.PrimaryGoal.ToString();

            onboarding = new OnboardingDataDto
            {
                Sex = od.Sex.ToString(),
                TargetWeightKg = effectiveTargetWeightKg,
                BodyType = od.BodyType.ToString(),
                PrimaryGoal = effectivePrimaryGoal,
                TimeHorizon = od.TimeHorizon.ToString(),
                JobType = od.JobType.ToString(),
                SleepHours = od.SleepHours,
                StressLevel = od.StressLevel,
                CurrentTrainingFrequency = od.CurrentTrainingFrequency.ToString(),
                DesiredTrainingFrequency = od.DesiredTrainingFrequency.ToString(),
                FitnessRating = od.FitnessRating,
                PreferredActivities = od.PreferredActivities,
                Injuries = od.Injuries,
                MealsPerDay = od.MealsPerDay.ToString(),
                DietaryStyle = od.DietaryStyle.ToString(),
                Allergies = od.Allergies,
                PlanExperience = od.PlanExperience.ToString(),
                PastBlockers = od.PastBlockers,
                PrimaryMotivation = od.PrimaryMotivation.ToString(),
                DerivedActivityLevel = od.DerivedActivityLevel.ToString(),
                DerivedNutritionGoal = od.DerivedNutritionGoal.ToString(),
                Bmr = od.Bmr,
                Tdee = od.Tdee,
                AdjustedKcal = od.AdjustedKcal,
                ProteinGrams = od.ProteinGrams,
                CarbsGrams = od.CarbsGrams,
                FatGrams = od.FatGrams,
                MealDistribution = od.MealDistribution,
            };
        }

        await Send.OkAsync(new GetClientDashboardResponse
        {
            LinkId = link.Id,
            ClientPublicId = clientProfile.PublicId,
            ClientUserId = clientProfile.UserId,
            Email = clientProfile.User.Email!,
            FirstName = clientProfile.User.FirstName,
            LastName = clientProfile.User.LastName,
            DateOfBirth = clientProfile.DateOfBirth,
            HeightCm = clientProfile.HeightCm,
            WeightKg = clientProfile.WeightKg,
            Goals = clientProfile.Goals,
            LinkedAt = link.DateUpdated ?? link.DateCreated,
            IsActive = link.IsActive,
            CanViewNutritionPlans = link.CanViewNutritionPlans,
            CanViewTrainingPlans = link.CanViewTrainingPlans,
            HasRegistered = clientProfile.User.EmailConfirmed,
            QuestionnaireStatus = questionnaireStatus,
            QuestionnaireTitle = questionnaireTitle,
            QuestionnaireResponsePublicId = questionnaireResponsePublicId,
            QuestionnaireSubmittedAt = qResponse?.SubmittedAt,
            TotalMeasurements = totalMeasurements,
            TotalProgressPhotos = totalProgressPhotos,
            LatestMeasurement = latestMeasurement,
            CompliancePercent = compliancePercent,
            CurrentStreak = currentStreak,
            Onboarding = onboarding
        }, ct);
    }
}

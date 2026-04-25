using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.GetClientDashboard;

/// <summary>
/// Endpoint for retrieving a client's dashboard summary.
/// The requesting trainer must have an active link to the client.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="audit">Audit logging service.</param>
/// <param name="complianceService">Service for calculating compliance metrics.</param>
public class GetClientDashboardEndpoint(IApplicationDbContext db, IAuditService audit, IComplianceService complianceService)
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

        // Calculate compliance data (last 7 days)
        decimal? compliancePercent = null;
        var currentStreak = 0;

        try
        {
            var complianceFrom = DateTime.UtcNow.Date.AddDays(-7);
            var complianceTo = DateTime.UtcNow.Date.AddDays(1).AddTicks(-1);
            var compliance = await complianceService.CalculateComplianceAsync(
                clientProfile.PublicId, complianceFrom, complianceTo, ct);
            compliancePercent = compliance.CompliancePercent;
            currentStreak = await complianceService.CalculateStreakAsync(clientProfile.PublicId, ct);
        }
        catch
        {
            // Compliance data is optional — may fail if no active nutrition plan exists
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

        OnboardingDataDto? onboarding = null;
        if (clientProfile.OnboardingData is { } od)
        {
            onboarding = new OnboardingDataDto
            {
                Sex = od.Sex.ToString(),
                TargetWeightKg = od.TargetWeightKg,
                BodyType = od.BodyType.ToString(),
                PrimaryGoal = od.PrimaryGoal.ToString(),
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
            ClientPublicId = clientProfile.PublicId,
            Email = clientProfile.User.Email!,
            FirstName = clientProfile.User.FirstName,
            LastName = clientProfile.User.LastName,
            DateOfBirth = clientProfile.DateOfBirth,
            HeightCm = clientProfile.HeightCm,
            WeightKg = clientProfile.WeightKg,
            Goals = clientProfile.Goals,
            LinkedAt = link.DateUpdated ?? link.DateCreated,
            IsActive = link.IsActive,
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

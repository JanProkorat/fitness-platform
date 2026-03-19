using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Client.SubmitOnboarding;

/// <summary>
/// Endpoint for submitting the client onboarding questionnaire.
/// Idempotent — replaces existing data if already submitted.
/// </summary>
/// <param name="dbContext">Database context.</param>
/// <param name="audit">Audit logging service.</param>
/// <param name="calculator">Macro calculator service for BMR/TDEE/macro computation.</param>
public class SubmitOnboardingEndpoint(IApplicationDbContext dbContext, IAuditService audit, IMacroCalculatorService calculator)
    : Endpoint<SubmitOnboardingRequest, SubmitOnboardingResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/onboarding");
        Roles("Client");
        Summary(s =>
        {
            s.Summary = "Submit client onboarding questionnaire";
            s.Description = "Saves onboarding answers and marks onboarding as complete. Idempotent.";
            s.Responses[200] = "Onboarding complete";
            s.Responses[404] = "Client profile not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SubmitOnboardingRequest req, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(AppClaims.UserId)!);

        var profile = await dbContext.ClientProfiles
            .Include(cp => cp.OnboardingData)
            .FirstOrDefaultAsync(cp => cp.UserId == userId, ct);

        if (profile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var dateOfBirth = new DateTime(DateTime.UtcNow.Year - req.Age, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var data = profile.OnboardingData ?? new ClientOnboardingData { ClientProfileId = profile.Id };

        data.DateOfBirth = dateOfBirth;
        data.Sex = Enum.Parse<BiologicalSex>(req.Sex, true);
        data.HeightCm = req.HeightCm;
        data.WeightKg = req.WeightKg;
        data.TargetWeightKg = req.TargetWeightKg;
        data.BodyType = Enum.Parse<BodyType>(req.BodyType, true);
        data.PrimaryGoal = Enum.Parse<PrimaryGoal>(req.PrimaryGoal, true);
        data.TimeHorizon = Enum.Parse<TimeHorizon>(req.TimeHorizon, true);
        data.JobType = Enum.Parse<JobType>(req.JobType, true);
        data.SleepHours = req.SleepHours;
        data.StressLevel = req.StressLevel;
        data.CurrentTrainingFrequency = Enum.Parse<CurrentTrainingFrequency>(req.CurrentTrainingFrequency, true);
        data.DesiredTrainingFrequency = Enum.Parse<DesiredTrainingFrequency>(req.DesiredTrainingFrequency, true);
        data.FitnessRating = req.FitnessRating;
        data.GymAccess = !string.IsNullOrEmpty(req.GymAccess) ? Enum.Parse<GymAccess>(req.GymAccess, true) : GymAccess.No;
        data.PreferredActivities = string.Join(",", req.PreferredActivities);
        data.Injuries = string.Join(",", req.Injuries);
        data.MealsPerDay = Enum.Parse<MealsPerDay>(req.MealsPerDay, true);
        data.DietaryStyle = Enum.TryParse<DietaryStyle>(req.DietaryStyle, true, out var ds) ? ds : DietaryStyle.Standard;
        data.Allergies = string.Join(",", req.Allergies);
        data.DietRating = req.DietRating ?? 0;
        data.PlanExperience = Enum.Parse<PlanExperience>(req.PlanExperience, true);
        data.PastBlockers = string.Join(",", req.PastBlockers);
        data.PrimaryMotivation = Enum.Parse<PrimaryMotivation>(req.PrimaryMotivation, true);

        // --- Map onboarding data to calculator inputs ---

        // Map JobType + CurrentTrainingFrequency → ActivityLevel
        var activityLevel = (data.JobType, data.CurrentTrainingFrequency) switch
        {
            (JobType.Sedentary, CurrentTrainingFrequency.None) => ActivityLevel.Sedentary,
            (JobType.Sedentary, CurrentTrainingFrequency.Occasional) => ActivityLevel.LightlyActive,
            (JobType.Sedentary, CurrentTrainingFrequency.Regular) => ActivityLevel.ModeratelyActive,
            (JobType.Sedentary, CurrentTrainingFrequency.High) => ActivityLevel.VeryActive,
            (JobType.Standing, CurrentTrainingFrequency.None) => ActivityLevel.LightlyActive,
            (JobType.Standing, CurrentTrainingFrequency.Occasional) => ActivityLevel.ModeratelyActive,
            (JobType.Standing, CurrentTrainingFrequency.Regular) => ActivityLevel.VeryActive,
            (JobType.Standing, CurrentTrainingFrequency.High) => ActivityLevel.VeryActive,
            (JobType.Physical, CurrentTrainingFrequency.None) => ActivityLevel.ModeratelyActive,
            (JobType.Physical, CurrentTrainingFrequency.Occasional) => ActivityLevel.VeryActive,
            (JobType.Physical, CurrentTrainingFrequency.Regular) => ActivityLevel.VeryActive,
            (JobType.Physical, CurrentTrainingFrequency.High) => ActivityLevel.ExtremelyActive,
            _ => ActivityLevel.ModeratelyActive
        };

        // Map PrimaryGoal → NutritionGoal
        var nutritionGoal = data.PrimaryGoal switch
        {
            PrimaryGoal.LoseFat => NutritionGoal.Cut,
            PrimaryGoal.GainMuscle => NutritionGoal.Bulk,
            PrimaryGoal.Recomposition => NutritionGoal.Cut, // slight deficit for recomp
            PrimaryGoal.Fitness => NutritionGoal.Maintain,
            PrimaryGoal.Health => NutritionGoal.Maintain,
            _ => NutritionGoal.Maintain
        };

        // Calculate
        var bmr = calculator.CalculateBmr(data.WeightKg, data.HeightCm, req.Age, data.Sex);
        var tdee = calculator.CalculateTdee(bmr, activityLevel);
        var adjustedKcal = calculator.ApplyGoalAdjustment(tdee, nutritionGoal);
        var macros = calculator.CalculateMacroSplit(adjustedKcal); // defaults: 30/45/25

        data.DerivedActivityLevel = activityLevel;
        data.DerivedNutritionGoal = nutritionGoal;
        data.Bmr = bmr;
        data.Tdee = tdee;
        data.AdjustedKcal = adjustedKcal;
        data.ProteinGrams = macros.ProteinGrams ?? 0;
        data.CarbsGrams = macros.CarbsGrams ?? 0;
        data.FatGrams = macros.FatGrams ?? 0;

        if (profile.OnboardingData is null)
            dbContext.ClientOnboardingData.Add(data);

        profile.HeightCm = req.HeightCm;
        profile.WeightKg = req.WeightKg;
        profile.DateOfBirth = dateOfBirth;
        profile.IsOnboardingComplete = true;

        await dbContext.SaveChangesAsync(ct);

        await audit.LogAsync(
            userId, "SubmitOnboarding", nameof(ClientOnboardingData), profile.PublicId,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            newValues: $"{{\"onboardingComplete\":true}}", ct: ct);

        await Send.OkAsync(new SubmitOnboardingResponse { Message = "Onboarding complete" }, ct);
    }
}

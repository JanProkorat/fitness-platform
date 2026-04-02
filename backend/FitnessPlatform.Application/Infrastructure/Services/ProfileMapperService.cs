using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Maps questionnaire answers with a MappedField to the corresponding ClientProfile
/// and ClientOnboardingData properties.
/// </summary>
public class ProfileMapperService(IApplicationDbContext db, INotificationService notifications) : IProfileMapperService
{
    public async Task MapResponseToProfileAsync(QuestionnaireResponse response, CancellationToken ct = default)
    {
        var answers = await db.QuestionnaireAnswers
            .Include(a => a.Question)
            .Where(a => a.ResponseId == response.Id)
            .ToListAsync(ct);

        var clientProfile = await db.ClientProfiles
            .Include(cp => cp.OnboardingData)
            .FirstOrDefaultAsync(cp => cp.UserId == response.ClientId, ct);

        if (clientProfile is null) return;

        // Get or create onboarding data for storing detailed questionnaire fields
        var onboarding = clientProfile.OnboardingData;
        if (onboarding is null)
        {
            onboarding = new ClientOnboardingData { ClientProfileId = clientProfile.Id };
            db.ClientOnboardingData.Add(onboarding);
            clientProfile.OnboardingData = onboarding;
        }

        foreach (var answer in answers)
        {
            if (answer.Question.MappedField is null) continue;

            switch (answer.Question.MappedField)
            {
                // --- ClientProfile fields ---
                case "height":
                    if (answer.ValueNumber.HasValue)
                    {
                        clientProfile.HeightCm = answer.ValueNumber.Value;
                        onboarding.HeightCm = answer.ValueNumber.Value;
                    }
                    break;

                case "weight":
                    if (answer.ValueNumber.HasValue)
                    {
                        clientProfile.WeightKg = answer.ValueNumber.Value;
                        onboarding.WeightKg = answer.ValueNumber.Value;
                    }
                    break;

                case "birthDate":
                    if (DateTime.TryParse(answer.ValueText, out var dob))
                    {
                        clientProfile.DateOfBirth = dob;
                        onboarding.DateOfBirth = dob;
                    }
                    break;

                case "goal":
                    if (!string.IsNullOrEmpty(answer.ValueText))
                    {
                        clientProfile.Goals = answer.ValueText;
                        if (Enum.TryParse<PrimaryGoal>(answer.ValueText, true, out var pg))
                            onboarding.PrimaryGoal = pg;
                    }
                    break;

                case "injuries":
                    clientProfile.Injuries = answer.ValueJson ?? answer.ValueText;
                    onboarding.Injuries = answer.ValueJson ?? answer.ValueText ?? string.Empty;
                    break;

                case "allergies":
                    clientProfile.MedicalNotes = answer.ValueJson ?? answer.ValueText;
                    onboarding.Allergies = answer.ValueJson ?? answer.ValueText ?? string.Empty;
                    break;

                // --- ClientOnboardingData fields ---
                case "sex":
                    if (Enum.TryParse<BiologicalSex>(answer.ValueText, true, out var sex))
                        onboarding.Sex = sex;
                    break;

                case "targetWeight":
                    if (answer.ValueNumber.HasValue)
                        onboarding.TargetWeightKg = answer.ValueNumber.Value;
                    break;

                case "bodyType":
                    if (Enum.TryParse<BodyType>(answer.ValueText, true, out var bt))
                        onboarding.BodyType = bt;
                    break;

                case "timeHorizon":
                    if (Enum.TryParse<TimeHorizon>(answer.ValueText, true, out var th))
                        onboarding.TimeHorizon = th;
                    break;

                case "jobType":
                    if (Enum.TryParse<JobType>(answer.ValueText, true, out var jt))
                        onboarding.JobType = jt;
                    break;

                case "sleepHours":
                    if (answer.ValueNumber.HasValue)
                        onboarding.SleepHours = (int)answer.ValueNumber.Value;
                    break;

                case "stressLevel":
                    if (answer.ValueNumber.HasValue)
                        onboarding.StressLevel = (int)answer.ValueNumber.Value;
                    break;

                case "activityLevel":
                    if (Enum.TryParse<ActivityLevel>(answer.ValueText, true, out var al))
                        onboarding.DerivedActivityLevel = al;
                    break;

                case "currentTrainingFrequency":
                    if (Enum.TryParse<CurrentTrainingFrequency>(answer.ValueText, true, out var ctf))
                        onboarding.CurrentTrainingFrequency = ctf;
                    break;

                case "desiredTrainingFrequency":
                    if (Enum.TryParse<DesiredTrainingFrequency>(answer.ValueText, true, out var dtf))
                        onboarding.DesiredTrainingFrequency = dtf;
                    break;

                case "fitnessRating":
                    if (answer.ValueNumber.HasValue)
                        onboarding.FitnessRating = (int)answer.ValueNumber.Value;
                    break;

                case "gymAccess":
                    if (Enum.TryParse<GymAccess>(answer.ValueText, true, out var ga))
                        onboarding.GymAccess = ga;
                    break;

                case "preferredActivities":
                    onboarding.PreferredActivities = answer.ValueJson ?? answer.ValueText ?? string.Empty;
                    break;

                case "mealsPerDay":
                    if (Enum.TryParse<MealsPerDay>(answer.ValueText, true, out var mpd))
                        onboarding.MealsPerDay = mpd;
                    break;

                case "dietaryStyle":
                    if (Enum.TryParse<DietaryStyle>(answer.ValueText, true, out var ds))
                        onboarding.DietaryStyle = ds;
                    break;

                case "dietRating":
                    if (answer.ValueNumber.HasValue)
                        onboarding.DietRating = (int)answer.ValueNumber.Value;
                    break;

                case "planExperience":
                    if (Enum.TryParse<PlanExperience>(answer.ValueText, true, out var pe))
                        onboarding.PlanExperience = pe;
                    break;

                case "pastBlockers":
                    onboarding.PastBlockers = answer.ValueJson ?? answer.ValueText ?? string.Empty;
                    break;

                case "primaryMotivation":
                    if (Enum.TryParse<PrimaryMotivation>(answer.ValueText, true, out var pm))
                        onboarding.PrimaryMotivation = pm;
                    break;
            }
        }

        // Send notification to the professional
        var clientUser = await db.ClientProfiles
            .Include(cp => cp.User)
            .Where(cp => cp.UserId == response.ClientId)
            .Select(cp => cp.User)
            .FirstOrDefaultAsync(ct);

        var clientName = clientUser != null ? $"{clientUser.FirstName} {clientUser.LastName}" : "Klient";

        await notifications.CreateAsync(
            response.ProfessionalId,
            NotificationType.QuestionnaireSubmitted,
            "Dotazník vyplněn",
            $"{clientName} vyplnil(a) vstupní dotazník.",
            ct: ct);

        await db.SaveChangesAsync(ct);
    }
}

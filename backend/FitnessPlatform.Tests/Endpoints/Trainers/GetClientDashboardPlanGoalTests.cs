using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Trainers.GetClientDashboard;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// Tests for the plan-first goal/targetWeightKg sourcing in
/// <see cref="GetClientDashboardEndpoint"/> (Phase 3 of #493).
///
/// The endpoint reads <c>Goal</c> and <c>TargetWeightKg</c> from the most-recent
/// active <c>NutritionPlan</c> for the client, falling back to
/// <c>ClientOnboardingData</c> when no active plan is found.
/// </summary>
public class GetClientDashboardPlanGoalTests
{
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly IAuditService _audit = Substitute.For<IAuditService>();
    private readonly IComplianceService _complianceService = Substitute.For<IComplianceService>();

    /// <summary>
    /// When an active NutritionPlan has <c>Goal</c> and <c>TargetWeightKg</c> set,
    /// the dashboard response prefers the plan values over onboarding data.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ActivePlanHasGoal_ResponseUsesPlanGoal()
    {
        var clientUser = EntityBuilder.User.WithEmail("client@test.com").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(clientUser).Build();

        // Attach onboarding data with a DIFFERENT goal than the plan
        clientProfile.OnboardingData = new ClientOnboardingData
        {
            Id = 1,
            ClientProfileId = 1,
            PrimaryGoal = PrimaryGoal.LoseFat,       // onboarding says WeightLoss
            TargetWeightKg = 70.0m,                     // onboarding target
            // required fields
            Sex = BiologicalSex.Male,
            HeightCm = 175,
            WeightKg = 80,
            BodyType = BodyType.Mesomorph,
            TimeHorizon = TimeHorizon.SixMonths,
            JobType = JobType.Sedentary,
            SleepHours = 7,
            StressLevel = 3,
            CurrentTrainingFrequency = CurrentTrainingFrequency.Regular,
            DesiredTrainingFrequency = DesiredTrainingFrequency.FourPerWeek,
            FitnessRating = 6,
            MealsPerDay = MealsPerDay.FourToFive,
            DietaryStyle = DietaryStyle.Standard,
            PlanExperience = PlanExperience.TriedFailed,
            PrimaryMotivation = PrimaryMotivation.Appearance,
        };

        var link = EntityBuilder.ClientProfessionalLink
            .WithId(10)
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerProfile)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .With(link)
            .Build();

        // Active NutritionPlan with DIFFERENT goal
        var activePlan = PlanTestHelpers.CreatePlan(
            clientId: clientProfile.UserId,
            status: NutritionPlanStatus.Active);
        activePlan.Goal = PrimaryGoal.GainMuscle;       // plan says MuscleGain
        activePlan.TargetWeightKg = 85.0m;              // plan target

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [activePlan]);

        var ep = Factory.Create<GetClientDashboardEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, _audit, _complianceService, mongo);

        await ep.HandleAsync(new GetClientDashboardRequest
        {
            ClientId = clientProfile.PublicId
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Onboarding.Should().NotBeNull();
        // Plan values must win
        ep.Response.Onboarding!.PrimaryGoal.Should().Be(PrimaryGoal.GainMuscle.ToString());
        ep.Response.Onboarding!.TargetWeightKg.Should().Be(85.0m);
    }

    /// <summary>
    /// When no active NutritionPlan exists for the client, the dashboard
    /// response falls back to the <c>ClientOnboardingData</c> values.
    /// </summary>
    [Fact]
    public async Task HandleAsync_NoPlan_ResponseFallsBackToOnboarding()
    {
        var clientUser = EntityBuilder.User.WithEmail("client2@test.com").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(2).WithUserId(_trainerId).Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(2).WithUser(clientUser).Build();

        clientProfile.OnboardingData = new ClientOnboardingData
        {
            Id = 2,
            ClientProfileId = 2,
            PrimaryGoal = PrimaryGoal.LoseFat,
            TargetWeightKg = 68.0m,
            Sex = BiologicalSex.Female,
            HeightCm = 165,
            WeightKg = 72,
            BodyType = BodyType.Mesomorph,
            TimeHorizon = TimeHorizon.SixMonths,
            JobType = JobType.Sedentary,
            SleepHours = 8,
            StressLevel = 2,
            CurrentTrainingFrequency = CurrentTrainingFrequency.Regular,
            DesiredTrainingFrequency = DesiredTrainingFrequency.ThreePerWeek,
            FitnessRating = 5,
            MealsPerDay = MealsPerDay.TwoToThree,
            DietaryStyle = DietaryStyle.Standard,
            PlanExperience = PlanExperience.TriedFailed,
            PrimaryMotivation = PrimaryMotivation.Health,
        };

        var link = EntityBuilder.ClientProfessionalLink
            .WithId(11)
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerProfile)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .With(link)
            .Build();

        // Empty mongo — no active plans
        var mongo = PlanTestHelpers.CreateMockMongo();

        var ep = Factory.Create<GetClientDashboardEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, _audit, _complianceService, mongo);

        await ep.HandleAsync(new GetClientDashboardRequest
        {
            ClientId = clientProfile.PublicId
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Onboarding.Should().NotBeNull();
        // Onboarding fallback values must appear
        ep.Response.Onboarding!.PrimaryGoal.Should().Be(PrimaryGoal.LoseFat.ToString());
        ep.Response.Onboarding!.TargetWeightKg.Should().Be(68.0m);
    }

    /// <summary>
    /// When the active plan has <c>Goal = null</c> and <c>TargetWeightKg = null</c>,
    /// the response falls back to the onboarding data for both fields.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ActivePlanWithNullGoal_FallsBackToOnboarding()
    {
        var clientUser = EntityBuilder.User.WithEmail("client3@test.com").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(3).WithUserId(_trainerId).Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(3).WithUser(clientUser).Build();

        clientProfile.OnboardingData = new ClientOnboardingData
        {
            Id = 3,
            ClientProfileId = 3,
            PrimaryGoal = PrimaryGoal.LoseFat,
            TargetWeightKg = 65.0m,
            Sex = BiologicalSex.Female,
            HeightCm = 162,
            WeightKg = 70,
            BodyType = BodyType.Mesomorph,
            TimeHorizon = TimeHorizon.ThreeMonths,
            JobType = JobType.Sedentary,
            SleepHours = 7,
            StressLevel = 3,
            CurrentTrainingFrequency = CurrentTrainingFrequency.Occasional,
            DesiredTrainingFrequency = DesiredTrainingFrequency.TwoPerWeek,
            FitnessRating = 4,
            MealsPerDay = MealsPerDay.TwoToThree,
            DietaryStyle = DietaryStyle.Standard,
            PlanExperience = PlanExperience.Never,
            PrimaryMotivation = PrimaryMotivation.Health,
        };

        var link = EntityBuilder.ClientProfessionalLink
            .WithId(12)
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerProfile)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .With(link)
            .Build();

        // Active plan but goal fields are null (pre-migration document)
        var activePlan = PlanTestHelpers.CreatePlan(
            clientId: clientProfile.UserId,
            status: NutritionPlanStatus.Active);
        activePlan.Goal = null;
        activePlan.TargetWeightKg = null;

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [activePlan]);

        var ep = Factory.Create<GetClientDashboardEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, _audit, _complianceService, mongo);

        await ep.HandleAsync(new GetClientDashboardRequest
        {
            ClientId = clientProfile.PublicId
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Onboarding.Should().NotBeNull();
        // Plan nulls → onboarding fallback
        ep.Response.Onboarding!.PrimaryGoal.Should().Be(PrimaryGoal.LoseFat.ToString());
        ep.Response.Onboarding!.TargetWeightKg.Should().Be(65.0m);
    }
}

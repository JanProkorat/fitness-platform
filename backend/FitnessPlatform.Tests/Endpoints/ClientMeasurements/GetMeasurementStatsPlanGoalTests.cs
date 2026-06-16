using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientMeasurements.GetMeasurementStats;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;

namespace FitnessPlatform.Tests.Endpoints.ClientMeasurements;

/// <summary>
/// Tests for the plan-first <c>TargetWeightKg</c> sourcing in
/// <see cref="GetMeasurementStatsEndpoint"/> (Phase 3 of #493).
///
/// The endpoint reads <c>TargetWeightKg</c> from the most-recent active
/// <c>NutritionPlan</c> for the client, falling back to
/// <c>ClientOnboardingData.TargetWeightKg</c> when no active plan exists.
/// </summary>
public class GetMeasurementStatsPlanGoalTests
{
    private readonly Guid _clientId = Guid.NewGuid();       // ApplicationUser.Id (JWT claim)
    private readonly Guid _clientPublicId = Guid.NewGuid(); // ClientProfile.PublicId (plan join key)

    private static ClientOnboardingData BuildOnboarding(long clientProfileId, decimal? targetWeightKg) =>
        new()
        {
            Id = clientProfileId,
            ClientProfileId = clientProfileId,
            PrimaryGoal = PrimaryGoal.LoseFat,
            TargetWeightKg = targetWeightKg,
            Sex = BiologicalSex.Female,
            HeightCm = 165,
            WeightKg = 70,
            BodyType = BodyType.Mesomorph,
            TimeHorizon = TimeHorizon.SixMonths,
            JobType = JobType.Sedentary,
            SleepHours = 8,
            StressLevel = 2,
            CurrentTrainingFrequency = CurrentTrainingFrequency.Regular,
            DesiredTrainingFrequency = DesiredTrainingFrequency.ThreePerWeek,
            FitnessRating = 6,
            MealsPerDay = MealsPerDay.TwoToThree,
            DietaryStyle = DietaryStyle.Standard,
            PlanExperience = PlanExperience.TriedFailed,
            PrimaryMotivation = PrimaryMotivation.Health,
        };

    /// <summary>
    /// When an active NutritionPlan has <c>TargetWeightKg</c> set, the stats
    /// response prefers the plan value over the onboarding data.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ActivePlanHasTargetWeight_ResponseUsesPlanValue()
    {
        var clientProfile = EntityBuilder.ClientProfile
            .WithUserId(_clientId)
            .WithPublicId(_clientPublicId)
            .WithId(20)
            .Build();

        clientProfile.OnboardingData = BuildOnboarding(20, targetWeightKg: 60.0m); // onboarding = 60

        var db = new MockDbBuilder()
            .With(clientProfile)
            .Build();

        // Active plan — seeded with PublicId (what CreatePlanEndpoint writes)
        var activePlan = PlanTestHelpers.CreatePlan(
            clientId: _clientPublicId,
            status: NutritionPlanStatus.Active);
        activePlan.TargetWeightKg = 72.5m;  // plan = 72.5

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [activePlan]);

        var ep = Factory.Create<GetMeasurementStatsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            db, mongo);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        // Plan value must win over onboarding
        ep.Response.TargetWeightKg.Should().Be(72.5m);
    }

    /// <summary>
    /// When no active NutritionPlan exists, the stats response falls back to
    /// the <c>ClientOnboardingData.TargetWeightKg</c>.
    /// </summary>
    [Fact]
    public async Task HandleAsync_NoPlan_FallsBackToOnboarding()
    {
        var clientProfile = EntityBuilder.ClientProfile
            .WithUserId(_clientId)
            .WithPublicId(_clientPublicId)
            .WithId(21)
            .Build();

        clientProfile.OnboardingData = BuildOnboarding(21, targetWeightKg: 58.0m);

        var db = new MockDbBuilder()
            .With(clientProfile)
            .Build();

        // No active plans
        var mongo = PlanTestHelpers.CreateMockMongo();

        var ep = Factory.Create<GetMeasurementStatsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            db, mongo);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        // Onboarding fallback value
        ep.Response.TargetWeightKg.Should().Be(58.0m);
    }

    /// <summary>
    /// When the active plan has <c>TargetWeightKg = null</c>, the response
    /// falls back to the onboarding data.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ActivePlanWithNullTargetWeight_FallsBackToOnboarding()
    {
        var clientProfile = EntityBuilder.ClientProfile
            .WithUserId(_clientId)
            .WithPublicId(_clientPublicId)
            .WithId(22)
            .Build();

        clientProfile.OnboardingData = BuildOnboarding(22, targetWeightKg: 62.0m);

        var db = new MockDbBuilder()
            .With(clientProfile)
            .Build();

        // Active plan exists but has no target weight (pre-migration document) — seeded with PublicId
        var activePlan = PlanTestHelpers.CreatePlan(
            clientId: _clientPublicId,
            status: NutritionPlanStatus.Active);
        activePlan.TargetWeightKg = null;

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [activePlan]);

        var ep = Factory.Create<GetMeasurementStatsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            db, mongo);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        // Plan null → onboarding fallback
        ep.Response.TargetWeightKg.Should().Be(62.0m);
    }

    /// <summary>
    /// When neither active plan nor onboarding data provides a target weight,
    /// <c>TargetWeightKg</c> is null in the response (no crash).
    /// </summary>
    [Fact]
    public async Task HandleAsync_NoTargetWeightAnywhere_ReturnsNullTargetWeight()
    {
        var clientProfile = EntityBuilder.ClientProfile
            .WithUserId(_clientId)
            .WithPublicId(_clientPublicId)
            .WithId(23)
            .Build();

        // No onboarding data
        var db = new MockDbBuilder()
            .With(clientProfile)
            .Build();

        var mongo = PlanTestHelpers.CreateMockMongo();

        var ep = Factory.Create<GetMeasurementStatsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            db, mongo);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.TargetWeightKg.Should().BeNull();
    }
}

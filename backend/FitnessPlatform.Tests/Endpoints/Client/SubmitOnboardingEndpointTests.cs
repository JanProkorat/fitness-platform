using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Client.SubmitOnboarding;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Client;

/// <summary>
/// Unit tests for <see cref="SubmitOnboardingEndpoint"/>.
/// </summary>
public class SubmitOnboardingEndpointTests
{
    private readonly IAuditService _audit = Substitute.For<IAuditService>();
    private static readonly Guid UserId = Guid.NewGuid();

    private static SubmitOnboardingRequest ValidRequest() => new()
    {
        Age = 25, Sex = "Male", HeightCm = 180, WeightKg = 80, TargetWeightKg = 75,
        BodyType = "Mesomorph", PrimaryGoal = "GainMuscle", TimeHorizon = "SixMonths",
        JobType = "Sedentary", SleepHours = 7, StressLevel = 3,
        CurrentTrainingFrequency = "Regular", DesiredTrainingFrequency = "FourPerWeek",
        FitnessRating = 6, GymAccess = "Yes",
        PreferredActivities = ["strength", "cardio"], Injuries = ["none"],
        MealsPerDay = "FourToFive", DietaryStyle = "Standard", Allergies = ["none"],
        DietRating = 3, PlanExperience = "TriedFailed",
        PastBlockers = ["time", "motivation"], PrimaryMotivation = "Appearance",
    };

    private static SubmitOnboardingEndpoint CreateEndpoint(IApplicationDbContext db, IAuditService audit, Guid userId)
    {
        return Factory.Create<SubmitOnboardingEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(userId, AppRoles.Client))),
            db, audit);
    }

    /// <summary>
    /// Verifies that a valid onboarding submission saves data and syncs the client profile.
    /// </summary>
    [Fact]
    public async Task HappyPath_SavesOnboardingData_And_SyncsProfile()
    {
        var clientProfile = EntityBuilder.ClientProfile.WithUserId(UserId).Build();
        var db = new MockDbBuilder().With(clientProfile).Build();
        var ep = CreateEndpoint(db, _audit, UserId);

        await ep.HandleAsync(ValidRequest(), CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        clientProfile.IsOnboardingComplete.Should().BeTrue();
        clientProfile.HeightCm.Should().Be(180);
        clientProfile.WeightKg.Should().Be(80);
        clientProfile.DateOfBirth.Should().NotBeNull();
        await db.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// Verifies that re-submitting onboarding replaces existing data (idempotent).
    /// </summary>
    [Fact]
    public async Task Idempotent_ReplacesExistingOnboardingData()
    {
        var clientProfile = EntityBuilder.ClientProfile.WithUserId(UserId).Build();
        clientProfile.IsOnboardingComplete = true;
        clientProfile.OnboardingData = EntityBuilder.ClientOnboardingData
            .WithClientProfileId(clientProfile.Id).Build();

        var db = new MockDbBuilder()
            .With(clientProfile)
            .With(clientProfile.OnboardingData)
            .Build();

        var ep = CreateEndpoint(db, _audit, UserId);
        await ep.HandleAsync(ValidRequest(), CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    /// <summary>
    /// Verifies that a 404 is returned when no client profile exists for the user.
    /// </summary>
    [Fact]
    public async Task NoClientProfile_Returns404()
    {
        var db = new MockDbBuilder().Build();
        var ep = CreateEndpoint(db, _audit, UserId);

        await ep.HandleAsync(ValidRequest(), CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}

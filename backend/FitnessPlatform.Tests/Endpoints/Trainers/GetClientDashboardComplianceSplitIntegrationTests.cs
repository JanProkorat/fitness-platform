using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Trainers.GetClientDashboard;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using FitnessPlatform.Tests.Endpoints.TrainingPlans;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Bson;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// The client dashboard reports meal-only and training-only compliance and streaks next to the
/// combined figures. Real Mongo and the real ComplianceService, because stubbed percentages cannot
/// prove the per-discipline figures are computed from the right plan and logs.
/// </summary>
[Collection(TestCollection.Name)]
public class GetClientDashboardComplianceSplitIntegrationTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    private async Task<(Actor Trainer, Actor Client)> LinkedPairAsync(
        bool canViewNutritionPlans = true, bool canViewTrainingPlans = true)
    {
        var trainer = await TestActors.Professional(factory, UserRole.Trainer, UserRole.Nutritionist).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await TestActors.Link(factory, trainer, client)
            .CanViewNutritionPlans(canViewNutritionPlans)
            .CanViewTrainingPlans(canViewTrainingPlans)
            .CreateAsync(Ct);
        return (trainer, client);
    }

    private static (DateTime Monday, int IsoDayOfWeek) CurrentWeek()
    {
        var today = DateTime.UtcNow.Date;
        var isoDayOfWeek = today.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)today.DayOfWeek;
        return (today.AddDays(-(isoDayOfWeek - 1)), isoDayOfWeek);
    }

    /// <summary>Seeds an Active nutrition plan with exactly one meal planned, today, and one meal logged.</summary>
    private async Task SeedNutritionTodayLoggedAsync(Guid clientUserId, Guid authorUserId)
    {
        var (monday, isoDayOfWeek) = CurrentWeek();

        var plan = PlanTestHelpers.CreatePlan(
            clientId: clientUserId,
            nutritionistId: authorUserId,
            status: NutritionPlanStatus.Active,
            weekCount: 1);
        plan.Id = ObjectId.GenerateNewId();
        plan.StartDate = monday;
        plan.Weeks[0].Status = WeekStatus.Published;
        plan.Weeks[0].DatePublished = monday;
        plan.Weeks[0].Days[isoDayOfWeek - 1].Meals = [PlanTestHelpers.CreateMeal(order: 1)];

        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.NutritionPlans.InsertOneAsync(plan, cancellationToken: Ct);
        await mongo.MealLogs.InsertOneAsync(new MealLog
        {
            Id = ObjectId.GenerateNewId(),
            ClientId = clientUserId,
            PlanId = plan.ExternalId,
            MealId = Guid.NewGuid(),
            EatenAt = DateTime.UtcNow,
            FoodsEaten = [],
        }, cancellationToken: Ct);
    }

    /// <summary>Seeds an Active training plan with exactly one session scheduled today and never executed.</summary>
    private async Task SeedTrainingTodayMissedAsync(Guid clientUserId, Guid authorUserId)
    {
        var (monday, isoDayOfWeek) = CurrentWeek();

        var session = new TrainingSession
        {
            SessionId = Guid.NewGuid(),
            Name = "Session",
            Order = 1,
            StandaloneExercises =
            [
                new SessionExercise
                {
                    ExerciseId = Guid.NewGuid(),
                    ExerciseExternalId = Guid.NewGuid(),
                    ExerciseName = "Exercise",
                    Order = 1
                }
            ]
        };

        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.TrainingPlans.InsertOneAsync(new TrainingPlan
        {
            Id = ObjectId.GenerateNewId(),
            ExternalId = Guid.NewGuid(),
            ClientId = clientUserId,
            TrainerId = authorUserId,
            Name = "Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = monday,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    Days = TrainingPlanTestHelpers.MaterializeDays((isoDayOfWeek, session))
                }
            ],
            Version = 1,
            DateCreated = DateTime.UtcNow
        }, cancellationToken: Ct);
    }

    private static async Task<GetClientDashboardResponse> DashboardAsync(Actor trainer, Actor client)
    {
        var response = await trainer.Http.GetAsync($"/trainer/clients/{client.PublicId}", Ct);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<GetClientDashboardResponse>(JsonOptions, Ct))!;
    }

    [Fact]
    public async Task GetDashboard_BothCapabilities_ReturnsDistinctNutritionAndTrainingFigures()
    {
        var (trainer, client) = await LinkedPairAsync();
        await SeedNutritionTodayLoggedAsync(client.UserId, trainer.UserId);
        await SeedTrainingTodayMissedAsync(client.UserId, trainer.UserId);

        var dashboard = await DashboardAsync(trainer, client);

        dashboard.NutritionCompliancePercent.Should().Be(100m);
        dashboard.TrainingCompliancePercent.Should().Be(0m);
        dashboard.CompliancePercent.Should().Be(50m, "the combined figure keeps its meaning");
        dashboard.NutritionStreak.Should().Be(1);
        dashboard.TrainingStreak.Should().Be(0);
        dashboard.CurrentStreak.Should().Be(1, "the combined streak keeps its lenient either-discipline rule");
    }

    [Fact]
    public async Task GetDashboard_BothCapabilitiesAndNoNutritionPlan_ReturnsZeroNotNullForNutrition()
    {
        var (trainer, client) = await LinkedPairAsync();
        await SeedTrainingTodayMissedAsync(client.UserId, trainer.UserId);

        var dashboard = await DashboardAsync(trainer, client);

        dashboard.NutritionCompliancePercent.Should().Be(0m);
        dashboard.NutritionStreak.Should().Be(0);
        dashboard.TrainingCompliancePercent.Should().Be(0m);
    }

    [Fact]
    public async Task GetDashboard_TrainingOnlyLink_DoesNotLeakNutritionFigures()
    {
        var (trainer, client) = await LinkedPairAsync(canViewNutritionPlans: false);
        await SeedNutritionTodayLoggedAsync(client.UserId, trainer.UserId);
        await SeedTrainingTodayMissedAsync(client.UserId, trainer.UserId);

        var dashboard = await DashboardAsync(trainer, client);

        dashboard.NutritionCompliancePercent.Should().BeNull();
        dashboard.NutritionStreak.Should().BeNull();
        dashboard.TrainingCompliancePercent.Should().Be(0m);
        dashboard.TrainingStreak.Should().Be(0);
        dashboard.CompliancePercent.Should().Be(0m);
    }
}

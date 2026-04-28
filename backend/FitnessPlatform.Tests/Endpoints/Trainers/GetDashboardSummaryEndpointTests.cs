using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Trainers.GetDashboardSummary;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// Unit tests for <see cref="GetDashboardSummaryEndpoint"/>.
/// Focuses on the <see cref="ClientDashboardItem.AvatarBlobUrl"/> projection.
/// </summary>
public class GetDashboardSummaryEndpointTests
{
    private readonly Guid _trainerUserId = Guid.NewGuid();

    // Stub compliance service — returns neutral zeros for every client.
    private static IComplianceService CreateStubComplianceService()
    {
        var svc = Substitute.For<IComplianceService>();

        svc.CalculateComplianceAsync(
                Arg.Any<Guid>(), Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(new ComplianceResult
            {
                CompliancePercent = 0m,
                NutritionCompliancePercent = 0m,
                TrainingCompliancePercent = 0m
            });

        svc.CalculateStreakAsync(
                Arg.Any<Guid>(), Arg.Any<ComplianceDiscipline>(), Arg.Any<CancellationToken>())
            .Returns(0);

        svc.CalculateAverageMacrosAsync(
                Arg.Any<Guid>(), Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(new NutrientTotals { Kcal = 0m });

        return svc;
    }

    /// <summary>
    /// Builds a minimal <see cref="IMongoContext"/> that returns empty collections
    /// for every query the dashboard endpoint fires.
    /// Pre-creates all cursors before calling Returns() to avoid the NSubstitute
    /// "nested substitute inside Returns()" pitfall.
    /// </summary>
    private static IMongoContext CreateEmptyMongo()
    {
        var mongo = Substitute.For<IMongoContext>();

        // Training plans — empty
        var emptyPlanCursor = CreateEmptyCursor<TrainingPlan>();
        var planCollection = Substitute.For<IMongoCollection<TrainingPlan>>();
        planCollection.FindAsync(
                Arg.Any<FilterDefinition<TrainingPlan>>(),
                Arg.Any<FindOptions<TrainingPlan, TrainingPlan>>(),
                Arg.Any<CancellationToken>())
            .Returns(emptyPlanCursor);
        mongo.TrainingPlans.Returns(planCollection);

        // Nutrition plans — empty (FindAsync + CountDocumentsAsync)
        var emptyNutritionCursor = CreateEmptyCursor<NutritionPlan>();
        var nutritionCollection = Substitute.For<IMongoCollection<NutritionPlan>>();
        nutritionCollection.FindAsync(
                Arg.Any<FilterDefinition<NutritionPlan>>(),
                Arg.Any<FindOptions<NutritionPlan, NutritionPlan>>(),
                Arg.Any<CancellationToken>())
            .Returns(emptyNutritionCursor);
        nutritionCollection.CountDocumentsAsync(
                Arg.Any<FilterDefinition<NutritionPlan>>(),
                Arg.Any<CountOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(0L);
        mongo.NutritionPlans.Returns(nutritionCollection);

        // Meal logs — empty (projected to Guid)
        var emptyMealCursor = CreateEmptyCursor<Guid>();
        var mealLogCollection = Substitute.For<IMongoCollection<MealLog>>();
        mealLogCollection.FindAsync(
                Arg.Any<FilterDefinition<MealLog>>(),
                Arg.Any<FindOptions<MealLog, Guid>>(),
                Arg.Any<CancellationToken>())
            .Returns(emptyMealCursor);
        mongo.MealLogs.Returns(mealLogCollection);

        // Workout logs — empty (projected to DateTime)
        var emptyWorkoutCursor = CreateEmptyCursor<DateTime>();
        var workoutLogCollection = Substitute.For<IMongoCollection<WorkoutLog>>();
        workoutLogCollection.FindAsync(
                Arg.Any<FilterDefinition<WorkoutLog>>(),
                Arg.Any<FindOptions<WorkoutLog, DateTime>>(),
                Arg.Any<CancellationToken>())
            .Returns(emptyWorkoutCursor);
        mongo.WorkoutLogs.Returns(workoutLogCollection);

        return mongo;
    }

    private static IAsyncCursor<T> CreateEmptyCursor<T>()
    {
        var cursor = Substitute.For<IAsyncCursor<T>>();
        cursor.Current.Returns([]);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(false);
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(false);
        return cursor;
    }

    private GetDashboardSummaryEndpoint CreateEndpoint(
        IApplicationDbContext db,
        IMongoContext? mongo = null,
        IComplianceService? compliance = null)
    {
        return Factory.Create<GetDashboardSummaryEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerUserId, AppRoles.Trainer))),
            db,
            mongo ?? CreateEmptyMongo(),
            compliance ?? CreateStubComplianceService());
    }

    [Fact]
    public async Task HandleAsync_ClientWithAvatar_ReturnsAvatarBlobUrl()
    {
        // Arrange
        const string expectedUrl = "avatars/client-abc123.jpg";

        var clientUser = EntityBuilder.User
            .WithEmail("avatar@test.com")
            .WithFirstName("Alice")
            .WithLastName("Smith")
            .Build();

        // Set AvatarBlobUrl directly — the builder doesn't expose it as a fluent method
        clientUser.AvatarBlobUrl = expectedUrl;

        var trainerProfile = EntityBuilder.ProfessionalProfile
            .WithId(1)
            .WithUserId(_trainerUserId)
            .Build();

        var clientProfile = EntityBuilder.ClientProfile
            .WithId(1)
            .WithUser(clientUser)
            .Build();

        var link = EntityBuilder.ClientProfessionalLink
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerProfile)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .With(link)
            .Build();

        var ep = CreateEndpoint(db);

        // Act
        await ep.HandleAsync(TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Clients.Should().ContainSingle();
        ep.Response.Clients[0].AvatarBlobUrl.Should().Be(expectedUrl);
    }

    [Fact]
    public async Task HandleAsync_ClientWithoutAvatar_ReturnsNullAvatarBlobUrl()
    {
        // Arrange
        var clientUser = EntityBuilder.User
            .WithEmail("noavatar@test.com")
            .WithFirstName("Bob")
            .WithLastName("Jones")
            .Build();

        // AvatarBlobUrl left as null (default)

        var trainerProfile = EntityBuilder.ProfessionalProfile
            .WithId(2)
            .WithUserId(_trainerUserId)
            .Build();

        var clientProfile = EntityBuilder.ClientProfile
            .WithId(2)
            .WithUser(clientUser)
            .Build();

        var link = EntityBuilder.ClientProfessionalLink
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerProfile)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .With(link)
            .Build();

        var ep = CreateEndpoint(db);

        // Act
        await ep.HandleAsync(TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Clients.Should().ContainSingle();
        ep.Response.Clients[0].AvatarBlobUrl.Should().BeNull();
    }
}

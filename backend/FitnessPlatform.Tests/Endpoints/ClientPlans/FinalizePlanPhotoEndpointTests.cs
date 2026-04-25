using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientPlans.FinalizePlanPhoto;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientPlans;

/// <summary>
/// Tests for <see cref="FinalizePlanPhotoEndpoint"/>.
/// </summary>
public class FinalizePlanPhotoEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    private MockDbBuilder CreateDbBuilder() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId });

    private FinalizePlanPhotoEndpoint CreateEndpoint(IMongoContext mongo, IApplicationDbContext db) =>
        Factory.Create<FinalizePlanPhotoEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db);

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static IMongoContext CreateMongoWithNutritionPlan(NutritionPlan? plan = null)
    {
        var mongo = Substitute.For<IMongoContext>();
        var plans = plan is not null ? new[] { plan } : Array.Empty<NutritionPlan>();

        // Build mock collections before assigning to Returns to avoid NSubstitute pitfall
        var nutritionCollection = PlanTestHelpers.CreateMockMongo(plans).NutritionPlans;
        var trainingCollection = CreateEmptyTrainingCollection();

        mongo.NutritionPlans.Returns(nutritionCollection);
        mongo.TrainingPlans.Returns(trainingCollection);
        return mongo;
    }

    private static IMongoContext CreateMongoWithTrainingPlan(TrainingPlan? plan = null)
    {
        var mongo = Substitute.For<IMongoContext>();
        var plans = plan is not null ? new List<TrainingPlan> { plan } : new List<TrainingPlan>();

        // Build mock collections before assigning to Returns to avoid NSubstitute pitfall
        var nutritionCollection = PlanTestHelpers.CreateMockMongo().NutritionPlans;
        var trainingCollection = CreateTrainingCollection(plans);

        mongo.NutritionPlans.Returns(nutritionCollection);
        mongo.TrainingPlans.Returns(trainingCollection);
        return mongo;
    }

    private static IMongoCollection<TrainingPlan> CreateEmptyTrainingCollection() =>
        CreateTrainingCollection([]);

    private static IMongoCollection<TrainingPlan> CreateTrainingCollection(List<TrainingPlan> plans)
    {
        var collection = Substitute.For<IMongoCollection<TrainingPlan>>();
        collection.FindAsync(
                Arg.Any<FilterDefinition<TrainingPlan>>(),
                Arg.Any<FindOptions<TrainingPlan, TrainingPlan>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                var cursor = Substitute.For<IAsyncCursor<TrainingPlan>>();
                var moved = false;
                cursor.Current.Returns(plans);
                cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
                {
                    if (moved) return false;
                    moved = true;
                    return plans.Count > 0;
                });
                return cursor;
            });
        return collection;
    }

    // ── Happy-path: nutrition plan ────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NutritionPlanFound_Returns201WithPlanPhotoResponse()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(externalId: planId, clientId: _clientId);
        var mongo = CreateMongoWithNutritionPlan(plan);
        var db = CreateDbBuilder().Build();

        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new FinalizePlanPhotoRequest
        {
            PlanId = planId,
            BlobUrl = "plan-photos/abc/photo.jpg",
            Category = PlanPhotoCategory.Body
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);
        ep.Response.BlobUrl.Should().Be("plan-photos/abc/photo.jpg");
        ep.Response.Category.Should().Be(PlanPhotoCategory.Body);
        ep.Response.PlanId.Should().Be(planId);
        ep.Response.PlanType.Should().Be(PlanPhotoType.Nutrition);
        ep.Response.UploadedByUserId.Should().Be(_clientId);
        ep.Response.Id.Should().NotBeEmpty();
    }

    [Fact]
    public async Task HandleAsync_TrainingPlanFallback_Returns201WithTrainingType()
    {
        var planId = Guid.NewGuid();
        var trainingPlan = new TrainingPlan
        {
            ExternalId = planId,
            ClientId = _clientId,
            Status = TrainingPlanStatus.Active
        };

        var mongo = CreateMongoWithTrainingPlan(trainingPlan);
        var db = CreateDbBuilder().Build();

        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new FinalizePlanPhotoRequest
        {
            PlanId = planId,
            BlobUrl = "plan-photos/abc/photo.png",
            Category = PlanPhotoCategory.FreeForm
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);
        ep.Response.PlanType.Should().Be(PlanPhotoType.Training);
    }

    [Fact]
    public async Task HandleAsync_FoodCategory_SetsMealLogId()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(externalId: planId, clientId: _clientId);
        var mongo = CreateMongoWithNutritionPlan(plan);
        var db = CreateDbBuilder().Build();

        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new FinalizePlanPhotoRequest
        {
            PlanId = planId,
            BlobUrl = "plan-photos/abc/food.jpg",
            Category = PlanPhotoCategory.Food,
            MealLogId = "60a8f1c3d5e7b20012345678"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);
        ep.Response.MealLogId.Should().Be("60a8f1c3d5e7b20012345678");
    }

    [Fact]
    public async Task HandleAsync_NonFoodCategory_IgnoresMealLogId()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(externalId: planId, clientId: _clientId);
        var mongo = CreateMongoWithNutritionPlan(plan);
        var db = CreateDbBuilder().Build();

        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new FinalizePlanPhotoRequest
        {
            PlanId = planId,
            BlobUrl = "plan-photos/abc/body.jpg",
            Category = PlanPhotoCategory.Body,
            MealLogId = "should-be-ignored"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);
        ep.Response.MealLogId.Should().BeNull();
    }

    [Fact]
    public async Task HandleAsync_NoPlanExists_Returns404()
    {
        var mongo = CreateMongoWithNutritionPlan(null);
        var db = CreateDbBuilder().Build();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new FinalizePlanPhotoRequest
        {
            PlanId = Guid.NewGuid(),
            BlobUrl = "plan-photos/abc/photo.jpg",
            Category = PlanPhotoCategory.Body
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClientProfile_Returns404()
    {
        var mongo = CreateMongoWithNutritionPlan(null);
        var db = new MockDbBuilder().Build();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new FinalizePlanPhotoRequest
        {
            PlanId = Guid.NewGuid(),
            BlobUrl = "plan-photos/abc/photo.jpg",
            Category = PlanPhotoCategory.Body
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_TakenAtProvided_UsesProvidedTimestamp()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(externalId: planId, clientId: _clientId);
        var mongo = CreateMongoWithNutritionPlan(plan);
        var db = CreateDbBuilder().Build();

        var expectedTakenAt = new DateTime(2026, 1, 15, 10, 30, 0, DateTimeKind.Utc);
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new FinalizePlanPhotoRequest
        {
            PlanId = planId,
            BlobUrl = "plan-photos/abc/photo.jpg",
            Category = PlanPhotoCategory.Body,
            TakenAt = expectedTakenAt
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);
        ep.Response.TakenAt.Should().Be(expectedTakenAt);
    }
}

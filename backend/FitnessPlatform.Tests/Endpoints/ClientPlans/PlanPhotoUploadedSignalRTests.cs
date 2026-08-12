using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientNutrition.SaveDayPhotos;
using FitnessPlatform.Application.Features.ClientNutrition.SaveMealPhotos;
using FitnessPlatform.Application.Features.ClientPlans;
using FitnessPlatform.Application.Features.ClientPlans.FinalizePlanPhoto;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientPlans;

/// <summary>
/// Verifies the <c>planPhotoUploaded</c> SignalR broadcast behaviour across the three
/// endpoints that create <see cref="FitnessPlatform.Application.Domain.Entities.PlanPhoto"/> rows:
/// <list type="bullet">
///   <item><see cref="FinalizePlanPhotoEndpoint"/> — nutrition plan path</item>
///   <item><see cref="FinalizePlanPhotoEndpoint"/> — training plan path</item>
///   <item><see cref="SaveMealPhotosEndpoint"/> — dual-write from meal diary</item>
///   <item><see cref="SaveDayPhotosEndpoint"/> — dual-write from day diary</item>
/// </list>
/// </summary>
public class PlanPhotoUploadedSignalRTests
{
    // ── Shared identities ────────────────────────────────────────────────────────

    private readonly Guid _clientId = Guid.NewGuid();
    private readonly Guid _nutritionistId = Guid.NewGuid();
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _otherProfessionalId = Guid.NewGuid();

    // ── Notifier + loggers ───────────────────────────────────────────────────────

    private readonly IRealtimeNotifier _notifier = Substitute.For<IRealtimeNotifier>();
    private readonly ILogger<FinalizePlanPhotoEndpoint> _finalizeLogger =
        Substitute.For<ILogger<FinalizePlanPhotoEndpoint>>();
    private readonly ILogger<SaveMealPhotosEndpoint> _mealLogger =
        Substitute.For<ILogger<SaveMealPhotosEndpoint>>();
    private readonly ILogger<SaveDayPhotosEndpoint> _dayLogger =
        Substitute.For<ILogger<SaveDayPhotosEndpoint>>();

    // ── DB builder ───────────────────────────────────────────────────────────────

    private IApplicationDbContext CreateMockDb() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

    // ── Mongo helpers for FinalizePlanPhoto ──────────────────────────────────────

    private IMongoContext CreateMongoWithNutritionPlan(NutritionPlan plan)
    {
        // Build collections BEFORE assigning to Returns to avoid NSubstitute pitfall.
        var nutritionCollection = PlanTestHelpers.CreateMockMongo([plan]).NutritionPlans;
        var trainingCollection = CreateEmptyTrainingPlanCollection();

        var mongo = Substitute.For<IMongoContext>();
        mongo.NutritionPlans.Returns(nutritionCollection);
        mongo.TrainingPlans.Returns(trainingCollection);
        return mongo;
    }

    private IMongoContext CreateMongoWithTrainingPlan(TrainingPlan plan)
    {
        // Build collections BEFORE assigning to Returns to avoid NSubstitute pitfall.
        var nutritionCollection = PlanTestHelpers.CreateMockMongo().NutritionPlans;
        var trainingCollection = CreateTrainingPlanCollection([plan]);

        var mongo = Substitute.For<IMongoContext>();
        mongo.NutritionPlans.Returns(nutritionCollection);
        mongo.TrainingPlans.Returns(trainingCollection);
        return mongo;
    }

    private static IMongoCollection<TrainingPlan> CreateEmptyTrainingPlanCollection() =>
        CreateTrainingPlanCollection([]);

    private static IMongoCollection<TrainingPlan> CreateTrainingPlanCollection(List<TrainingPlan> plans)
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

    // ── Mongo helpers for SaveMealPhotos / SaveDayPhotos ─────────────────────────

    private static IMongoCollection<MealLog> CreateMealLogCollection(List<MealLog>? logs = null)
    {
        logs ??= [];
        var collection = Substitute.For<IMongoCollection<MealLog>>();
        collection.FindAsync(
                Arg.Any<FilterDefinition<MealLog>>(),
                Arg.Any<FindOptions<MealLog, MealLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateCursor(logs));
        collection.InsertOneAsync(Arg.Any<MealLog>(), Arg.Any<InsertOneOptions>(), Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);
        var updateResult = Substitute.For<UpdateResult>();
        updateResult.ModifiedCount.Returns(1);
        collection.UpdateOneAsync(
                Arg.Any<FilterDefinition<MealLog>>(),
                Arg.Any<UpdateDefinition<MealLog>>(),
                Arg.Any<UpdateOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(updateResult);
        return collection;
    }

    private static IMongoCollection<DayLog> CreateDayLogCollection(List<DayLog>? logs = null)
    {
        logs ??= [];
        var collection = Substitute.For<IMongoCollection<DayLog>>();
        collection.FindAsync(
                Arg.Any<FilterDefinition<DayLog>>(),
                Arg.Any<FindOptions<DayLog, DayLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateCursor(logs));
        collection.InsertOneAsync(Arg.Any<DayLog>(), Arg.Any<InsertOneOptions>(), Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);
        var updateResult = Substitute.For<UpdateResult>();
        updateResult.ModifiedCount.Returns(1);
        collection.UpdateOneAsync(
                Arg.Any<FilterDefinition<DayLog>>(),
                Arg.Any<UpdateDefinition<DayLog>>(),
                Arg.Any<UpdateOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(updateResult);
        return collection;
    }

    private static IAsyncCursor<T> CreateCursor<T>(List<T> items)
    {
        var cursor = Substitute.For<IAsyncCursor<T>>();
        var moved = false;
        cursor.Current.Returns(items);
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return items.Count > 0;
        });
        return cursor;
    }

    // ── Endpoint factories ───────────────────────────────────────────────────────

    private FinalizePlanPhotoEndpoint CreateFinalizeEndpoint(
        IMongoContext mongo, IApplicationDbContext db, ProfessionalAuthHelper? authHelper = null) =>
        Factory.Create<FinalizePlanPhotoEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, authHelper ?? EndpointTestHelpers.CreateGrantingAuthHelper(), _finalizeLogger, new FakeBlobStorageService());

    private SaveMealPhotosEndpoint CreateSaveMealPhotosEndpoint(
        IMongoContext mongo, IApplicationDbContext db, ProfessionalAuthHelper? authHelper = null) =>
        Factory.Create<SaveMealPhotosEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, authHelper ?? EndpointTestHelpers.CreateGrantingAuthHelper(), _mealLogger, new FakeBlobStorageService());

    private SaveDayPhotosEndpoint CreateSaveDayPhotosEndpoint(
        IMongoContext mongo, IApplicationDbContext db, ProfessionalAuthHelper? authHelper = null) =>
        Factory.Create<SaveDayPhotosEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, authHelper ?? EndpointTestHelpers.CreateGrantingAuthHelper(), _dayLogger, new FakeBlobStorageService());

    // ════════════════════════════════════════════════════════════════════════════
    // FinalizePlanPhoto — nutrition plan
    // ════════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task FinalizePlanPhoto_NutritionPlan_EmitsPlanPhotoUploaded_ToNutritionist()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            clientId: _clientId,
            nutritionistId: _nutritionistId);

        var mongo = CreateMongoWithNutritionPlan(plan);
        var db = CreateMockDb();
        var ep = CreateFinalizeEndpoint(mongo, db);

        await ep.HandleAsync(new FinalizePlanPhotoRequest
        {
            PlanId = planId,
            BlobUrl = $"plan-photos/{planId}/{Guid.NewGuid()}.jpg",
            Category = PlanPhotoCategory.Body
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        // The owning nutritionist must receive exactly one event
        await _notifier.Received(1).NotifyAsync(
            _nutritionistId,
            "planphotouploaded",
            Arg.Is<PlanPhotoUploadedEvent>(e =>
                e.PlanId == planId &&
                e.Category == PlanPhotoCategory.Body),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task FinalizePlanPhoto_NutritionPlan_DoesNotEmit_ToDifferentProfessional()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            clientId: _clientId,
            nutritionistId: _nutritionistId);

        var mongo = CreateMongoWithNutritionPlan(plan);
        var db = CreateMockDb();
        var ep = CreateFinalizeEndpoint(mongo, db);

        await ep.HandleAsync(new FinalizePlanPhotoRequest
        {
            PlanId = planId,
            BlobUrl = $"plan-photos/{planId}/{Guid.NewGuid()}.jpg",
            Category = PlanPhotoCategory.Body
        }, TestContext.Current.CancellationToken);

        // A different professional must NOT receive the event
        await _notifier.DidNotReceive().NotifyAsync(
            _otherProfessionalId,
            Arg.Any<string>(),
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task FinalizePlanPhoto_NutritionPlan_PayloadHasCorrectPhotoIdAndTakenAt()
    {
        var planId = Guid.NewGuid();
        var takenAt = new DateTime(2026, 3, 15, 10, 30, 0, DateTimeKind.Utc);
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            clientId: _clientId,
            nutritionistId: _nutritionistId);

        var mongo = CreateMongoWithNutritionPlan(plan);
        var db = CreateMockDb();
        var ep = CreateFinalizeEndpoint(mongo, db);

        await ep.HandleAsync(new FinalizePlanPhotoRequest
        {
            PlanId = planId,
            BlobUrl = $"plan-photos/{planId}/{Guid.NewGuid()}.jpg",
            Category = PlanPhotoCategory.FreeForm,
            TakenAt = takenAt
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        // PhotoId must match the created photo's PublicId; TakenAt must match the request
        await _notifier.Received(1).NotifyAsync(
            _nutritionistId,
            "planphotouploaded",
            Arg.Is<PlanPhotoUploadedEvent>(e =>
                e.PhotoId == ep.Response.Id &&
                e.TakenAt == takenAt &&
                e.Category == PlanPhotoCategory.FreeForm),
            Arg.Any<CancellationToken>());
    }

    // ════════════════════════════════════════════════════════════════════════════
    // FinalizePlanPhoto — training plan
    // ════════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task FinalizePlanPhoto_TrainingPlan_EmitsPlanPhotoUploaded_ToTrainer()
    {
        var planId = Guid.NewGuid();
        var trainingPlan = new TrainingPlan
        {
            ExternalId = planId,
            ClientId = _clientId,
            TrainerId = _trainerId,
            Status = TrainingPlanStatus.Active
        };

        var mongo = CreateMongoWithTrainingPlan(trainingPlan);
        var db = CreateMockDb();
        var ep = CreateFinalizeEndpoint(mongo, db);

        await ep.HandleAsync(new FinalizePlanPhotoRequest
        {
            PlanId = planId,
            BlobUrl = $"plan-photos/{planId}/{Guid.NewGuid()}.jpg",
            Category = PlanPhotoCategory.FreeForm
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await _notifier.Received(1).NotifyAsync(
            _trainerId,
            "planphotouploaded",
            Arg.Is<PlanPhotoUploadedEvent>(e =>
                e.PlanId == planId &&
                e.Category == PlanPhotoCategory.FreeForm),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task FinalizePlanPhoto_TrainingPlan_DoesNotEmit_ToDifferentProfessional()
    {
        var planId = Guid.NewGuid();
        var trainingPlan = new TrainingPlan
        {
            ExternalId = planId,
            ClientId = _clientId,
            TrainerId = _trainerId,
            Status = TrainingPlanStatus.Active
        };

        var mongo = CreateMongoWithTrainingPlan(trainingPlan);
        var db = CreateMockDb();
        var ep = CreateFinalizeEndpoint(mongo, db);

        await ep.HandleAsync(new FinalizePlanPhotoRequest
        {
            PlanId = planId,
            BlobUrl = $"plan-photos/{planId}/{Guid.NewGuid()}.jpg",
            Category = PlanPhotoCategory.FreeForm
        }, TestContext.Current.CancellationToken);

        await _notifier.DidNotReceive().NotifyAsync(
            _otherProfessionalId,
            Arg.Any<string>(),
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    // ════════════════════════════════════════════════════════════════════════════
    // FinalizePlanPhoto — best-effort: broadcast failure does not fail mutation
    // ════════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task FinalizePlanPhoto_BroadcastThrows_MutationStillSucceeds()
    {
        _notifier
            .NotifyAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<object>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new InvalidOperationException("hub unavailable")));

        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            clientId: _clientId,
            nutritionistId: _nutritionistId);

        var mongo = CreateMongoWithNutritionPlan(plan);
        var db = CreateMockDb();
        var ep = CreateFinalizeEndpoint(mongo, db);

        var act = () => ep.HandleAsync(new FinalizePlanPhotoRequest
        {
            PlanId = planId,
            BlobUrl = $"plan-photos/{planId}/{Guid.NewGuid()}.jpg",
            Category = PlanPhotoCategory.Body
        }, TestContext.Current.CancellationToken);

        await act.Should().NotThrowAsync();
        ep.HttpContext.Response.StatusCode.Should().Be(201);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // SaveMealPhotos — dual-write emits event only for newly-inserted rows
    // ════════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task SaveMealPhotos_NewPhotos_EmitsPlanPhotoUploaded_ToNutritionist()
    {
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Eggs");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Breakfast, foods: food);

        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            nutritionistId: _nutritionistId,
            status: NutritionPlanStatus.Active);
        plan.Weeks[0].Days[0].Meals.Add(meal);

        // Build collection BEFORE mongo.MealLogs.Returns() to avoid NSubstitute pitfall
        var mealLogCollection = CreateMealLogCollection();
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();
        var ep = CreateSaveMealPhotosEndpoint(mongo, db);

        await ep.HandleAsync(new SaveMealPhotosRequest
        {
            MealId = mealId,
            Photos = [new MealPhotoInput { BlobUrl = "https://cdn.example.com/photo.jpg" }]
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        // Nutritionist receives the event
        await _notifier.Received(1).NotifyAsync(
            _nutritionistId,
            "planphotouploaded",
            Arg.Is<PlanPhotoUploadedEvent>(e =>
                e.PlanId == plan.ExternalId &&
                e.Category == PlanPhotoCategory.Food),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SaveMealPhotos_DifferentProfessional_DoesNotReceive()
    {
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Chicken");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Lunch, foods: food);

        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            nutritionistId: _nutritionistId,
            status: NutritionPlanStatus.Active);
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var mealLogCollection = CreateMealLogCollection();
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();
        var ep = CreateSaveMealPhotosEndpoint(mongo, db);

        await ep.HandleAsync(new SaveMealPhotosRequest
        {
            MealId = mealId,
            Photos = [new MealPhotoInput { BlobUrl = "https://cdn.example.com/chicken.jpg" }]
        }, TestContext.Current.CancellationToken);

        // A different professional must NOT receive
        await _notifier.DidNotReceive().NotifyAsync(
            _otherProfessionalId,
            Arg.Any<string>(),
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SaveMealPhotos_ExistingPhotoResubmitted_DoesNotEmitForExisting()
    {
        // If a blob URL already has a PlanPhoto row, the dual-write is idempotent
        // and no new event should fire for that URL.
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Pasta");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Dinner, foods: food);

        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            nutritionistId: _nutritionistId,
            status: NutritionPlanStatus.Active);
        plan.Weeks[0].Days[0].Meals.Add(meal);

        const string existingUrl = "https://cdn.example.com/existing.jpg";

        // Pre-seed an existing PlanPhoto row so the dual-write skips it
        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .With(new PlanPhoto
            {
                PublicId = Guid.NewGuid(),
                ClientProfileId = 0,   // matches the mock via BlobUrl lookup
                PlanId = plan.ExternalId,
                Category = PlanPhotoCategory.Food,
                BlobUrl = existingUrl,
                TakenAt = DateTime.UtcNow.AddHours(-1),
                UploadedByUserId = _clientId,
                DateCreated = DateTime.UtcNow.AddHours(-1),
                DateUpdated = DateTime.UtcNow.AddHours(-1)
            })
            .Build();

        var mealLogColl = CreateMealLogCollection();
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        mongo.MealLogs.Returns(mealLogColl);

        var ep = CreateSaveMealPhotosEndpoint(mongo, db);

        await ep.HandleAsync(new SaveMealPhotosRequest
        {
            MealId = mealId,
            Photos = [new MealPhotoInput { BlobUrl = existingUrl }]
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        // No event should be emitted — the row already existed
        await _notifier.DidNotReceive().NotifyAsync(
            Arg.Any<Guid>(),
            "planphotouploaded",
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    // ════════════════════════════════════════════════════════════════════════════
    // SaveDayPhotos — dual-write emits event only for newly-inserted rows
    // ════════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task SaveDayPhotos_NewPhotos_EmitsPlanPhotoUploaded_ToNutritionist()
    {
        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            nutritionistId: _nutritionistId,
            status: NutritionPlanStatus.Active);

        // Build collection BEFORE mongo.DayLogs.Returns() to avoid NSubstitute pitfall
        var dayLogCollection = CreateDayLogCollection();
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        mongo.DayLogs.Returns(dayLogCollection);

        var db = CreateMockDb();
        var ep = CreateSaveDayPhotosEndpoint(mongo, db);

        await ep.HandleAsync(new SaveDayPhotosRequest
        {
            Photos =
            [
                new DayPhotoInput { BlobUrl = "https://cdn.example.com/progress.jpg", Category = DayPhotoCategory.Progress }
            ]
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        await _notifier.Received(1).NotifyAsync(
            _nutritionistId,
            "planphotouploaded",
            Arg.Is<PlanPhotoUploadedEvent>(e =>
                e.PlanId == plan.ExternalId &&
                e.Category == PlanPhotoCategory.Body),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SaveDayPhotos_DifferentProfessional_DoesNotReceive()
    {
        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            nutritionistId: _nutritionistId,
            status: NutritionPlanStatus.Active);

        var dayLogCollection = CreateDayLogCollection();
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        mongo.DayLogs.Returns(dayLogCollection);

        var db = CreateMockDb();
        var ep = CreateSaveDayPhotosEndpoint(mongo, db);

        await ep.HandleAsync(new SaveDayPhotosRequest
        {
            Photos = [new DayPhotoInput { BlobUrl = "https://cdn.example.com/day.jpg", Category = DayPhotoCategory.Free }]
        }, TestContext.Current.CancellationToken);

        await _notifier.DidNotReceive().NotifyAsync(
            _otherProfessionalId,
            Arg.Any<string>(),
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SaveDayPhotos_EmptyPhotoList_NoEventEmitted()
    {
        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            nutritionistId: _nutritionistId,
            status: NutritionPlanStatus.Active);

        var dayLogCollection = CreateDayLogCollection();
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        mongo.DayLogs.Returns(dayLogCollection);

        var db = CreateMockDb();
        var ep = CreateSaveDayPhotosEndpoint(mongo, db);

        await ep.HandleAsync(new SaveDayPhotosRequest
        {
            Photos = []
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        // No photos inserted → no events
        await _notifier.DidNotReceive().NotifyAsync(
            Arg.Any<Guid>(),
            "planphotouploaded",
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    // ════════════════════════════════════════════════════════════════════════════
    // F6 residual: FinalizePlanPhoto gates BOTH domains on the professional's
    // CURRENT link capability, not mere plan authorship (nutritionistId/trainerId
    // are permanent fields on the plan document; the underlying link is not).
    // ════════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task FinalizePlanPhoto_NutritionPlan_NutritionistLacksCapability_DoesNotEmit()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            clientId: _clientId,
            nutritionistId: _nutritionistId);

        var mongo = CreateMongoWithNutritionPlan(plan);
        var db = CreateMockDb();
        var ep = CreateFinalizeEndpoint(mongo, db, EndpointTestHelpers.CreateGrantingAuthHelper(hasAccess: false));

        await ep.HandleAsync(new FinalizePlanPhotoRequest
        {
            PlanId = planId,
            BlobUrl = $"plan-photos/{planId}/{Guid.NewGuid()}.jpg",
            Category = PlanPhotoCategory.Body
        }, TestContext.Current.CancellationToken);

        // The PlanPhoto row still gets created — only the broadcast is gated.
        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await _notifier.DidNotReceive().NotifyAsync(
            Arg.Any<Guid>(),
            "planphotouploaded",
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task FinalizePlanPhoto_TrainingPlan_TrainerLacksCapability_DoesNotEmit()
    {
        var planId = Guid.NewGuid();
        var trainingPlan = new TrainingPlan
        {
            ExternalId = planId,
            ClientId = _clientId,
            TrainerId = _trainerId,
            Status = TrainingPlanStatus.Active
        };

        var mongo = CreateMongoWithTrainingPlan(trainingPlan);
        var db = CreateMockDb();
        var ep = CreateFinalizeEndpoint(mongo, db, EndpointTestHelpers.CreateGrantingAuthHelper(hasAccess: false));

        await ep.HandleAsync(new FinalizePlanPhotoRequest
        {
            PlanId = planId,
            BlobUrl = $"plan-photos/{planId}/{Guid.NewGuid()}.jpg",
            Category = PlanPhotoCategory.FreeForm
        }, TestContext.Current.CancellationToken);

        // The PlanPhoto row still gets created — only the broadcast is gated.
        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await _notifier.DidNotReceive().NotifyAsync(
            Arg.Any<Guid>(),
            "planphotouploaded",
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }
}

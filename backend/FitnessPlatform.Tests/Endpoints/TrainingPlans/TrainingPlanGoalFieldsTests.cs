using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.TrainingPlans.CreateTrainingPlan;
using FitnessPlatform.Application.Features.TrainingPlans.UpdateTrainingPlan;
using FluentValidation;
using FitnessPlatform.Tests.Builders;
using MongoDB.Bson;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.TrainingPlans;

/// <summary>
/// Tests verifying that <c>Goal</c> and <c>TargetWeightKg</c> fields are
/// correctly persisted when creating and updating training plans.
/// </summary>
public class TrainingPlanGoalFieldsTests
{
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _clientId = Guid.NewGuid();

    private static ISessionLockService StubLockService()
    {
        var svc = Substitute.For<ISessionLockService>();
        svc.GetStateAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(Array.Empty<SessionLock>());
        return svc;
    }

    // ── CreateTrainingPlan ────────────────────────────────────────────────────

    [Fact]
    public async Task CreateTrainingPlan_WithGoalAndTargetWeight_PersistsFields()
    {
        var mongo = TrainingPlanTestHelpers.CreateMockMongo();
        var authHelper = TrainingPlanTestHelpers.CreateMockAuthHelper(true);
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<CreateTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, authHelper, db);

        var request = new CreateTrainingPlanRequest
        {
            ClientId = _clientId,
            Name = "Strength Block",
            WeekCount = 4,
            Goal = PrimaryGoal.GainMuscle,
            TargetWeightKg = 88.0m
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.TrainingPlans.Received(1).InsertOneAsync(
            Arg.Is<TrainingPlan>(p =>
                p.Goal == PrimaryGoal.GainMuscle &&
                p.TargetWeightKg == 88.0m),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateTrainingPlan_WithoutGoal_PersistsNullFields()
    {
        var mongo = TrainingPlanTestHelpers.CreateMockMongo();
        var authHelper = TrainingPlanTestHelpers.CreateMockAuthHelper(true);
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<CreateTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, authHelper, db);

        var request = new CreateTrainingPlanRequest
        {
            ClientId = _clientId,
            Name = "Basic Block",
            WeekCount = 2
            // Goal and TargetWeightKg omitted
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.TrainingPlans.Received(1).InsertOneAsync(
            Arg.Is<TrainingPlan>(p =>
                p.Goal == null &&
                p.TargetWeightKg == null),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public void CreateTrainingPlan_Validator_WithZeroTargetWeight_FailsValidation()
    {
        var validator = new CreateTrainingPlanValidator();
        var request = new CreateTrainingPlanRequest
        {
            ClientId = _clientId,
            Name = "Bad Plan",
            WeekCount = 1,
            TargetWeightKg = 0m  // must be > 0
        };

        var result = validator.Validate(request);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName.StartsWith(nameof(CreateTrainingPlanRequest.TargetWeightKg)));
    }

    // ── UpdateTrainingPlan ────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateTrainingPlan_WithGoalAndTargetWeight_PersistsFields()
    {
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(
            externalId: planId,
            trainerId: _trainerId,
            weekCount: 1,
            version: 1);

        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);

        var ep = Factory.Create<UpdateTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, StubLockService(), Substitute.For<IRealtimeNotifier>());

        var request = new UpdateTrainingPlanRequest
        {
            PlanId = planId,
            Name = "Updated Block",
            Version = 1,
            Goal = PrimaryGoal.LoseFat,
            TargetWeightKg = 75.0m,
            Weeks = [new UpdateTrainingWeekRequest { WeekNumber = 1, Sessions = [] }]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await mongo.TrainingPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<TrainingPlan>>(),
            Arg.Is<TrainingPlan>(p =>
                p.Goal == PrimaryGoal.LoseFat &&
                p.TargetWeightKg == 75.0m),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateTrainingPlan_StaleConcurrencyVersion_Returns409()
    {
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(
            externalId: planId,
            trainerId: _trainerId,
            weekCount: 1,
            version: 5);   // server is at version 5

        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);

        var ep = Factory.Create<UpdateTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, StubLockService(), Substitute.For<IRealtimeNotifier>());

        var request = new UpdateTrainingPlanRequest
        {
            PlanId = planId,
            Name = "Updated Block",
            Version = 1,  // stale
            Goal = PrimaryGoal.GainMuscle,
            TargetWeightKg = 90.0m,
            Weeks = [new UpdateTrainingWeekRequest { WeekNumber = 1, Sessions = [] }]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        // Version mismatch must return 409, not 200
        ep.HttpContext.Response.StatusCode.Should().Be(409);
    }

    // ── Bson round-trip: fields survive serialize → deserialize ───────────────

    [Fact]
    public void TrainingPlanDocument_GoalAndTargetWeightKg_RoundTripViaBson()
    {
        var original = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = Guid.NewGuid(),
            TrainerId = Guid.NewGuid(),
            Name = "Bson Test Training Plan",
            Goal = PrimaryGoal.LoseFat,
            TargetWeightKg = 70.0m,
            Version = 1,
            DateCreated = DateTime.UtcNow
        };

        var bsonDoc = original.ToBsonDocument();
        var deserialized = MongoDB.Bson.Serialization.BsonSerializer
            .Deserialize<TrainingPlan>(bsonDoc);

        deserialized.Goal.Should().Be(PrimaryGoal.LoseFat);
        deserialized.TargetWeightKg.Should().Be(70.0m);
    }

    [Fact]
    public void TrainingPlanDocument_NullGoalAndTargetWeightKg_RoundTripViaBson()
    {
        var original = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = Guid.NewGuid(),
            TrainerId = Guid.NewGuid(),
            Name = "Bson Null Training Plan",
            Goal = null,
            TargetWeightKg = null,
            Version = 1,
            DateCreated = DateTime.UtcNow
        };

        var bsonDoc = original.ToBsonDocument();
        var deserialized = MongoDB.Bson.Serialization.BsonSerializer
            .Deserialize<TrainingPlan>(bsonDoc);

        deserialized.Goal.Should().BeNull();
        deserialized.TargetWeightKg.Should().BeNull();
    }
}

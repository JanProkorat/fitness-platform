using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.NutritionPlans.CreatePlan;
using FitnessPlatform.Application.Features.NutritionPlans.UpdatePlan;
using FluentValidation;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Builders;
using MongoDB.Bson;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlans;

/// <summary>
/// Tests verifying that <c>Goal</c> and <c>TargetWeightKg</c> fields are
/// correctly persisted when creating and updating nutrition plans.
/// </summary>
public class PlanGoalFieldsTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();
    private readonly Guid _clientId = Guid.NewGuid();

    // ── CreatePlan ────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreatePlan_WithGoalAndTargetWeight_PersistsFields()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();
        var authHelper = CreateAuthHelper(hasLink: true);
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<CreatePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, authHelper, db);

        var request = new CreatePlanRequest
        {
            ClientId = _clientId,
            Name = "Weight Loss Plan",
            WeekCount = 1,
            Goal = PrimaryGoal.LoseFat,
            TargetWeightKg = 75.5m
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.NutritionPlans.Received(1).InsertOneAsync(
            Arg.Is<NutritionPlan>(p =>
                p.Goal == PrimaryGoal.LoseFat &&
                p.TargetWeightKg == 75.5m),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreatePlan_WithoutGoalAndTargetWeight_PersistsNullFields()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();
        var authHelper = CreateAuthHelper(hasLink: true);
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<CreatePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, authHelper, db);

        var request = new CreatePlanRequest
        {
            ClientId = _clientId,
            Name = "Basic Plan",
            WeekCount = 1
            // Goal and TargetWeightKg omitted — should be null on the document
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.NutritionPlans.Received(1).InsertOneAsync(
            Arg.Is<NutritionPlan>(p =>
                p.Goal == null &&
                p.TargetWeightKg == null),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public void CreatePlan_Validator_WithZeroTargetWeight_FailsValidation()
    {
        var validator = new CreatePlanValidator();
        var request = new CreatePlanRequest
        {
            ClientId = _clientId,
            Name = "Bad Plan",
            WeekCount = 1,
            TargetWeightKg = 0m   // must be > 0
        };

        var result = validator.Validate(request);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(CreatePlanRequest.TargetWeightKg));
    }

    [Fact]
    public void CreatePlan_Validator_WithNegativeTargetWeight_FailsValidation()
    {
        var validator = new CreatePlanValidator();
        var request = new CreatePlanRequest
        {
            ClientId = _clientId,
            Name = "Bad Plan",
            WeekCount = 1,
            TargetWeightKg = -5m  // must be > 0
        };

        var result = validator.Validate(request);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(CreatePlanRequest.TargetWeightKg));
    }

    // ── UpdatePlan ────────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdatePlan_WithGoalAndTargetWeight_PersistsFields()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            weekCount: 1,
            version: 1);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var macroCalc = Substitute.For<IMacroCalculatorService>();

        var ep = Factory.Create<UpdatePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo,
            macroCalc,
            new MockDbBuilder().Build(),
            Substitute.For<IRealtimeNotifier>());

        var req = new UpdatePlanRequest
        {
            PlanId = planId,
            Name = "Updated Plan",
            Version = 1,
            Goal = PrimaryGoal.GainMuscle,
            TargetWeightKg = 90.0m,
            Weeks = []
        };

        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        await mongo.NutritionPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Is<NutritionPlan>(p =>
                p.Goal == PrimaryGoal.GainMuscle &&
                p.TargetWeightKg == 90.0m),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdatePlan_ClearsGoalToNull_PersistsNull()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            weekCount: 1,
            version: 1);
        plan.Goal = PrimaryGoal.LoseFat;
        plan.TargetWeightKg = 70.0m;

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var macroCalc = Substitute.For<IMacroCalculatorService>();

        var ep = Factory.Create<UpdatePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo,
            macroCalc,
            new MockDbBuilder().Build(),
            Substitute.For<IRealtimeNotifier>());

        var req = new UpdatePlanRequest
        {
            PlanId = planId,
            Name = "Plan Without Goal",
            Version = 1,
            Goal = null,
            TargetWeightKg = null,
            Weeks = []
        };

        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        await mongo.NutritionPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Is<NutritionPlan>(p =>
                p.Goal == null &&
                p.TargetWeightKg == null),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdatePlan_StaleConcurrencyVersion_Returns409()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            weekCount: 1,
            version: 3);   // server is at version 3

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var macroCalc = Substitute.For<IMacroCalculatorService>();

        var ep = Factory.Create<UpdatePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo,
            macroCalc,
            new MockDbBuilder().Build(),
            Substitute.For<IRealtimeNotifier>());

        var req = new UpdatePlanRequest
        {
            PlanId = planId,
            Name = "Updated Plan",
            Version = 1,  // stale — client thinks it is still at 1
            Goal = PrimaryGoal.LoseFat,
            TargetWeightKg = 75.0m,
            Weeks = []
        };

        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        // Version mismatch must return 409, not 200
        ep.HttpContext.Response.StatusCode.Should().Be(409);
    }

    // ── Bson round-trip: fields survive serialize → deserialize ───────────────

    [Fact]
    public void NutritionPlanDocument_GoalAndTargetWeightKg_RoundTripViaBson()
    {
        var original = new NutritionPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = Guid.NewGuid(),
            NutritionistId = Guid.NewGuid(),
            Name = "Bson Test Plan",
            Goal = PrimaryGoal.GainMuscle,
            TargetWeightKg = 82.5m,
            Version = 1,
            DateCreated = DateTime.UtcNow
        };

        var bsonDoc = original.ToBsonDocument();
        var deserialized = MongoDB.Bson.Serialization.BsonSerializer
            .Deserialize<NutritionPlan>(bsonDoc);

        deserialized.Goal.Should().Be(PrimaryGoal.GainMuscle);
        deserialized.TargetWeightKg.Should().Be(82.5m);
    }

    [Fact]
    public void NutritionPlanDocument_NullGoalAndTargetWeightKg_RoundTripViaBson()
    {
        var original = new NutritionPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = Guid.NewGuid(),
            NutritionistId = Guid.NewGuid(),
            Name = "Bson Null Test Plan",
            Goal = null,
            TargetWeightKg = null,
            Version = 1,
            DateCreated = DateTime.UtcNow
        };

        var bsonDoc = original.ToBsonDocument();
        var deserialized = MongoDB.Bson.Serialization.BsonSerializer
            .Deserialize<NutritionPlan>(bsonDoc);

        deserialized.Goal.Should().BeNull();
        deserialized.TargetWeightKg.Should().BeNull();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private static NutritionAuthHelper CreateAuthHelper(bool hasLink)
    {
        var db = Substitute.For<IApplicationDbContext>();
        var helper = Substitute.ForPartsOf<NutritionAuthHelper>(db);
        helper.HasActiveLinkAsync(
                Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(hasLink);
        return helper;
    }
}

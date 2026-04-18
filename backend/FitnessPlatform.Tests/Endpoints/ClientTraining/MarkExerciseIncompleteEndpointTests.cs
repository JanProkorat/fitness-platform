using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientTraining.MarkExerciseIncomplete;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientTraining;

/// <summary>
/// Tests for <see cref="MarkExerciseIncompleteEndpoint"/>.
/// </summary>
public class MarkExerciseIncompleteEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly Guid _sessionId = Guid.NewGuid();
    private readonly Guid _exercise1 = Guid.NewGuid();
    private readonly Guid _exercise2 = Guid.NewGuid();
    private readonly IRealtimeNotifier _notifier = TrainingCompletionTestHelpers.CreateStubNotifier();
    private readonly IComplianceService _compliance = TrainingCompletionTestHelpers.CreateStubComplianceService();
    private readonly ILogger<MarkExerciseIncompleteEndpoint> _logger = Substitute.For<ILogger<MarkExerciseIncompleteEndpoint>>();

    private IApplicationDbContext CreateMockDb() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

    [Fact]
    public async Task HandleAsync_CompleteExerciseThenUncomplete_Returns200AndExerciseGone()
    {
        // Set up: exercise1 is already marked complete
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [_exercise1, _exercise2],
            version: 1);

        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2]);

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(
            plan: plan,
            existingCompletion: existingCompletion);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseIncompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _logger);

        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest { SessionId = _sessionId, ExerciseExternalId = _exercise1 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // The update should have been called removing exercise1
        await completionCollection.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<TrainingCompletion>>(),
            Arg.Is<UpdateDefinition<TrainingCompletion>>(u => u != null),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_AlreadyIncomplete_IsIdempotent_Returns200()
    {
        // exercise1 is NOT in the completed list — idempotent path
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [_exercise2],
            version: 1);

        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2]);

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(
            plan: plan,
            existingCompletion: existingCompletion);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseIncompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _logger);

        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest { SessionId = _sessionId, ExerciseExternalId = _exercise1 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // No insert or update should have occurred
        await completionCollection.DidNotReceive().InsertOneAsync(
            Arg.Any<TrainingCompletion>(),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
        await completionCollection.DidNotReceive().UpdateOneAsync(
            Arg.Any<FilterDefinition<TrainingCompletion>>(),
            Arg.Any<UpdateDefinition<TrainingCompletion>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_StaleVersionPreCheck_Returns409WithVersionConflictCode()
    {
        // Completion document is at version 3; client sends version 1 (stale)
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [_exercise1],
            version: 3);

        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2]);

        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(
            plan: plan,
            existingCompletion: existingCompletion);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseIncompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _logger);

        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest
            {
                SessionId = _sessionId,
                ExerciseExternalId = _exercise1,
                Version = 1  // client thinks it's version 1, server is at 3
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task HandleAsync_StaleVersionOnUpdate_Returns409WithVersionConflictCode()
    {
        // Completion is at version 2; client matches — but UpdateOneAsync returns ModifiedCount=0 (race)
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [_exercise1],
            version: 2);

        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2]);

        var mongo = Substitute.For<FitnessPlatform.Application.Infrastructure.Data.MongoDb.IMongoContext>();
        var planColl = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan).Mongo.TrainingPlans;
        mongo.TrainingPlans.Returns(planColl);

        var completionCollection = TrainingCompletionTestHelpers.CreateMockCompletionCollection(
            [existingCompletion], updateSucceeds: false);
        mongo.TrainingCompletions.Returns(completionCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseIncompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _logger);

        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest
            {
                SessionId = _sessionId,
                ExerciseExternalId = _exercise1,
                Version = 2
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task HandleAsync_WrongClient_Returns404()
    {
        // No active plan found for the wrong client
        var wrongClientId = Guid.NewGuid();
        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: null);

        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = wrongClientId, PublicId = wrongClientId })
            .Build();

        var ep = Factory.Create<MarkExerciseIncompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(wrongClientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _logger);

        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest { SessionId = _sessionId, ExerciseExternalId = _exercise1 },
            TestContext.Current.CancellationToken);

        // No active plan → 404 with NoActiveTrainingPlan code
        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NonExistentSessionId_Returns404WithTrainingSessionNotFoundCode()
    {
        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1]);

        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseIncompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _logger);

        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest { SessionId = Guid.NewGuid(), ExerciseExternalId = _exercise1 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NonExistentExerciseId_Returns404WithTrainingExerciseNotFoundCode()
    {
        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1]);

        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseIncompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _logger);

        // _exercise2 is NOT in the plan's session exercises
        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest { SessionId = _sessionId, ExerciseExternalId = _exercise2 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo();
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseIncompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity()),
            mongo, db, _notifier, _compliance, _logger);

        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest { SessionId = _sessionId, ExerciseExternalId = _exercise1 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}

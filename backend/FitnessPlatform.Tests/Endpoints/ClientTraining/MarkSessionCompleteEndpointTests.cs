using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientTraining.MarkSessionComplete;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Builders;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientTraining;

/// <summary>
/// Tests for <see cref="MarkSessionCompleteEndpoint"/>.
/// </summary>
public class MarkSessionCompleteEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly Guid _sessionId = Guid.NewGuid();
    private readonly Guid _exercise1 = Guid.NewGuid();
    private readonly Guid _exercise2 = Guid.NewGuid();
    private readonly IRealtimeNotifier _notifier = TrainingCompletionTestHelpers.CreateStubNotifier();
    private readonly IComplianceService _compliance = TrainingCompletionTestHelpers.CreateStubComplianceService();
    private readonly ISessionLockService _lockService = CreateStubLockService();
    private static readonly IOptions<TrainingLockOptions> LockOptions =
        Options.Create(new TrainingLockOptions { LiveTtlHours = 6 });
    private readonly IClientLinkAuthorizationService _linkAuthorizationService = EndpointTestHelpers.CreateGrantingLinkAuthorizationService();
    private readonly ILogger<MarkSessionCompleteEndpoint> _logger = Substitute.For<ILogger<MarkSessionCompleteEndpoint>>();

    private static ISessionLockService CreateStubLockService()
    {
        var svc = Substitute.For<ISessionLockService>();
        svc.RefreshAsync(Arg.Any<Guid>(), Arg.Any<LockType>(), Arg.Any<TimeSpan>(),
            Arg.Any<CancellationToken>()).Returns(false);
        return svc;
    }

    private IApplicationDbContext CreateMockDb() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

    [Fact]
    public async Task HandleAsync_NewSession_MarksAllExercisesComplete()
    {
        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2]);

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkSessionCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        await ep.HandleAsync(
            new MarkSessionCompleteRequest { SessionId = _sessionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // All exercises in the session should be inserted in one completion document
        await completionCollection.Received(1).InsertOneAsync(
            Arg.Is<SessionExecution>(c =>
                c.ClientId == _clientId &&
                c.SessionId == _sessionId &&
                c.CompletedExerciseInstanceIds.Count == 2 &&
                c.CompletedExerciseInstanceIds.Contains(_exercise1) &&
                c.CompletedExerciseInstanceIds.Contains(_exercise2)),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NewSession_AlsoWritesCompletedSectionIds()
    {
        // The plan has one section (synthesized "Hlavní" via CreateActivePlan) containing both exercises.
        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2]);

        // Capture the section ID the plan was built with
        var sessionInPlan = plan.Weeks.SelectMany(w => w.Days).SelectMany(d => d.Sessions).First(s => s.SessionId == _sessionId);
        var expectedSectionId = sessionInPlan.Workouts[0].WorkoutId;

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkSessionCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        await ep.HandleAsync(
            new MarkSessionCompleteRequest { SessionId = _sessionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await completionCollection.Received(1).InsertOneAsync(
            Arg.Is<SessionExecution>(c =>
                c.CompletedWorkoutIds != null &&
                c.CompletedWorkoutIds.Contains(expectedSectionId) &&
                c.CompletedWorkoutIds.Count == 1),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_AlreadyComplete_IsIdempotent()
    {
        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2]);

        // Extract the section ID so we can include it in CompletedSectionIds
        var sessionInPlan = plan.Weeks.SelectMany(w => w.Days).SelectMany(d => d.Sessions).First(s => s.SessionId == _sessionId);
        var sectionId = sessionInPlan.Workouts[0].WorkoutId;

        // Create a completion that already has all exercises AND all sections
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [_exercise1, _exercise2],
            completedSectionIds: [sectionId],
            version: 1);

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(
            plan: plan,
            existingCompletion: existingCompletion);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkSessionCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        await ep.HandleAsync(
            new MarkSessionCompleteRequest { SessionId = _sessionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // No writes should occur since it's already complete
        await completionCollection.DidNotReceive().InsertOneAsync(
            Arg.Any<SessionExecution>(), Arg.Any<InsertOneOptions>(), Arg.Any<CancellationToken>());
        await completionCollection.DidNotReceive().UpdateOneAsync(
            Arg.Any<FilterDefinition<SessionExecution>>(),
            Arg.Any<UpdateDefinition<SessionExecution>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_PartialCompletion_FansOutAllExercises()
    {
        // Session has 2 exercises, only exercise1 was previously completed
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [_exercise1],
            version: 1);

        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2]);

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(
            plan: plan,
            existingCompletion: existingCompletion);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkSessionCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        await ep.HandleAsync(
            new MarkSessionCompleteRequest { SessionId = _sessionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // Should have updated with all exercise IDs
        await completionCollection.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<SessionExecution>>(),
            Arg.Is<UpdateDefinition<SessionExecution>>(u => u != null),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NonExistentSession_Returns404()
    {
        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1]);

        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkSessionCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        await ep.HandleAsync(
            new MarkSessionCompleteRequest { SessionId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo();
        var db = CreateMockDb();

        var ep = Factory.Create<MarkSessionCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity()),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        await ep.HandleAsync(
            new MarkSessionCompleteRequest { SessionId = _sessionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}

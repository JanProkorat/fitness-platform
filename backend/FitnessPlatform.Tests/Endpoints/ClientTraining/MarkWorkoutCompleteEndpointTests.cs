using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientTraining.MarkWorkoutComplete;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Builders;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientTraining;

/// <summary>
/// Tests for <see cref="MarkWorkoutCompleteEndpoint"/>.
/// </summary>
public class MarkWorkoutCompleteEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly Guid _sessionId = Guid.NewGuid();
    private readonly Guid _sectionId = Guid.NewGuid();
    private readonly IRealtimeNotifier _notifier = TrainingCompletionTestHelpers.CreateStubNotifier();
    private readonly IComplianceService _compliance = TrainingCompletionTestHelpers.CreateStubComplianceService();
    private readonly ISessionLockService _lockService = CreateStubLockService();
    private static readonly IOptions<TrainingLockOptions> LockOptions =
        Options.Create(new TrainingLockOptions { LiveTtlHours = 6 });
    private readonly IClientLinkAuthorizationService _linkAuthorizationService = EndpointTestHelpers.CreateGrantingLinkAuthorizationService();
    private readonly ILogger<MarkWorkoutCompleteEndpoint> _logger = Substitute.For<ILogger<MarkWorkoutCompleteEndpoint>>();

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

    /// <summary>
    /// Creates a plan that has a single exercise-free section (ForTime-style) in the session.
    /// </summary>
    private TrainingPlan CreatePlanWithExerciseFreeSection()
    {
        var start = TrainingCompletionTestHelpers.StartOfCurrentWeekUtc();
        return new FitnessPlatform.Application.Domain.Documents.TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "ForTime Plan",
            Status = FitnessPlatform.Application.Domain.Enums.TrainingPlanStatus.Active,
            StartDate = start,
            Weeks =
            [
                new FitnessPlatform.Application.Domain.Documents.TrainingWeek
                {
                    WeekNumber = 1,
                    Status = FitnessPlatform.Application.Domain.Enums.WeekStatus.Published,
                    DatePublished = start,
                    Days = Enumerable.Range(1, 7).Select(d =>
                        new FitnessPlatform.Application.Domain.Documents.TrainingDay
                        {
                            DayOfWeek = d,
                            Sessions =
                            [
                                new FitnessPlatform.Application.Domain.Documents.TrainingSession
                                {
                                    SessionId = d == (int)DateTime.UtcNow.DayOfWeek || d == 1 ? _sessionId : Guid.NewGuid(),
                                    Name = $"Day {d} Session",
                                    Order = 1,
                                    Workouts =
                                    [
                                        new FitnessPlatform.Application.Domain.Documents.TrainingWorkout
                                        {
                                            WorkoutId = _sectionId,
                                            Order = 0,
                                            Name = "Running ForTime",
                                            Exercises = [] // exercise-free section
                                        }
                                    ]
                                }
                            ]
                        }).ToList()
                }
            ],
            Version = 1,
            DateCreated = start
        };
    }

    [Fact]
    public async Task HandleAsync_NewCompletion_Returns200WithProgress()
    {
        var plan = CreatePlanWithExerciseFreeSection();

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkWorkoutCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger);

        await ep.HandleAsync(
            new MarkWorkoutCompleteRequest { SessionId = _sessionId, WorkoutId = _sectionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await completionCollection.Received(1).InsertOneAsync(
            Arg.Is<SessionExecution>(c =>
                c.ClientId == _clientId &&
                c.SessionId == _sessionId &&
                c.CompletedWorkoutIds != null &&
                c.CompletedWorkoutIds.Contains(_sectionId) &&
                c.CompletedWorkoutIds.Count == 1),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_AlreadyComplete_IsIdempotent_Returns200()
    {
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedSectionIds: [_sectionId],
            version: 1);

        var plan = CreatePlanWithExerciseFreeSection();

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(
            plan: plan,
            existingCompletion: existingCompletion);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkWorkoutCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger);

        // Mark section complete again — idempotent
        await ep.HandleAsync(
            new MarkWorkoutCompleteRequest { SessionId = _sessionId, WorkoutId = _sectionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // No insert or update should have occurred
        await completionCollection.DidNotReceive().InsertOneAsync(
            Arg.Any<SessionExecution>(),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
        await completionCollection.DidNotReceive().UpdateOneAsync(
            Arg.Any<FilterDefinition<SessionExecution>>(),
            Arg.Any<UpdateDefinition<SessionExecution>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_WrongClient_Returns404()
    {
        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: null);

        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = Guid.NewGuid(), PublicId = Guid.NewGuid() })
            .Build();

        var ep = Factory.Create<MarkWorkoutCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(Guid.NewGuid(), AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger);

        await ep.HandleAsync(
            new MarkWorkoutCompleteRequest { SessionId = _sessionId, WorkoutId = _sectionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_SectionNotFound_Returns404()
    {
        var plan = CreatePlanWithExerciseFreeSection();
        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkWorkoutCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger);

        await ep.HandleAsync(
            new MarkWorkoutCompleteRequest { SessionId = _sessionId, WorkoutId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_StaleVersion_Returns409()
    {
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedSectionIds: [],
            version: 2);

        var plan = CreatePlanWithExerciseFreeSection();

        var mongo = Substitute.For<FitnessPlatform.Application.Infrastructure.Data.MongoDb.IMongoContext>();
        var planColl = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan).Mongo.TrainingPlans;
        mongo.TrainingPlans.Returns(planColl);

        var completionCollection = TrainingCompletionTestHelpers.CreateMockSessionExecutionCollection(
            [existingCompletion], updateSucceeds: false);
        mongo.SessionExecutions.Returns(completionCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<MarkWorkoutCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger);

        await ep.HandleAsync(
            new MarkWorkoutCompleteRequest
            {
                SessionId = _sessionId,
                WorkoutId = _sectionId,
                Version = 2
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo();
        var db = CreateMockDb();

        var ep = Factory.Create<MarkWorkoutCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity()),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger);

        await ep.HandleAsync(
            new MarkWorkoutCompleteRequest { SessionId = _sessionId, WorkoutId = _sectionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}

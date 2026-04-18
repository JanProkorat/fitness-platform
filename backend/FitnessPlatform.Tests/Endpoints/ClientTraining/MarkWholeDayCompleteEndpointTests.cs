using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientTraining.MarkWholeDayComplete;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientTraining;

/// <summary>
/// Tests for <see cref="MarkWholeDayCompleteEndpoint"/>.
/// </summary>
public class MarkWholeDayCompleteEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly Guid _session1 = Guid.NewGuid();
    private readonly Guid _session2 = Guid.NewGuid();
    private readonly Guid _exercise1 = Guid.NewGuid();
    private readonly Guid _exercise2 = Guid.NewGuid();
    private readonly IRealtimeNotifier _notifier = TrainingCompletionTestHelpers.CreateStubNotifier();
    private readonly IComplianceService _compliance = TrainingCompletionTestHelpers.CreateStubComplianceService();
    private readonly ILogger<MarkWholeDayCompleteEndpoint> _logger = Substitute.For<ILogger<MarkWholeDayCompleteEndpoint>>();

    private IApplicationDbContext CreateMockDb() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

    /// <summary>
    /// Creates a plan with two sessions on the same day of week (today).
    /// </summary>
    private TrainingPlan CreateMultiSessionPlan()
    {
        var today = DateTime.UtcNow;
        var startOfWeek = today.Date.AddDays(-(int)today.DayOfWeek + 1); // Monday

        // ISO dow for today
        var todayDow = (int)today.DayOfWeek;
        todayDow = todayDow == 0 ? 7 : todayDow;

        return new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Multi-Session Day Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = startOfWeek,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = startOfWeek,
                    Sessions =
                    [
                        new TrainingSession
                        {
                            SessionId = _session1,
                            DayOfWeek = todayDow,
                            Name = "Session 1",
                            Order = 1,
                            Exercises =
                            [
                                new SessionExercise { ExerciseExternalId = _exercise1, ExerciseName = "Ex1", Order = 1, Sets = [] }
                            ]
                        },
                        new TrainingSession
                        {
                            SessionId = _session2,
                            DayOfWeek = todayDow,
                            Name = "Session 2",
                            Order = 2,
                            Exercises =
                            [
                                new SessionExercise { ExerciseExternalId = _exercise2, ExerciseName = "Ex2", Order = 1, Sets = [] }
                            ]
                        }
                    ]
                }
            ],
            Version = 1,
            DateCreated = startOfWeek
        };
    }

    [Fact]
    public async Task HandleAsync_MultipleSessions_InsertsCompletionForEach()
    {
        var plan = CreateMultiSessionPlan();
        var mongo = Substitute.For<FitnessPlatform.Application.Infrastructure.Data.MongoDb.IMongoContext>();

        // Plans collection returns the multi-session plan
        var planCollection = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan).Mongo.TrainingPlans;
        mongo.TrainingPlans.Returns(planCollection);

        // Completions collection starts empty (returns empty list for FindAsync)
        var completionCollection = TrainingCompletionTestHelpers.CreateMockCompletionCollection([]);
        mongo.TrainingCompletions.Returns(completionCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<MarkWholeDayCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _logger);

        await ep.HandleAsync(
            new MarkWholeDayCompleteRequest { Date = DateOnly.FromDateTime(DateTime.UtcNow) },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // Should have inserted two completion documents (one per session)
        await completionCollection.Received(2).InsertOneAsync(
            Arg.Any<TrainingCompletion>(),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_AlreadyCompleteSession_IsSkippedIdempotently()
    {
        var today = DateTime.UtcNow.Date;
        var plan = CreateMultiSessionPlan();

        // Session 1 is already fully complete
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _session1,
            date: today,
            completedExerciseIds: [_exercise1],
            version: 1);

        var mongo = Substitute.For<FitnessPlatform.Application.Infrastructure.Data.MongoDb.IMongoContext>();
        var planCollection = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan).Mongo.TrainingPlans;
        mongo.TrainingPlans.Returns(planCollection);

        // Completions collection returns the existing completion (for session1)
        // Note: both session queries will return the same existing completion because mock
        // doesn't filter — this tests the "already complete" idempotency branch for session1
        var completionCollection = TrainingCompletionTestHelpers.CreateMockCompletionCollection([existingCompletion]);
        mongo.TrainingCompletions.Returns(completionCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<MarkWholeDayCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _logger);

        await ep.HandleAsync(
            new MarkWholeDayCompleteRequest { Date = DateOnly.FromDateTime(today) },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task HandleAsync_NoPlan_Returns404()
    {
        var mongo = Substitute.For<FitnessPlatform.Application.Infrastructure.Data.MongoDb.IMongoContext>();
        var planCollection = TrainingCompletionTestHelpers.CreateMockMongo().Mongo.TrainingPlans;
        mongo.TrainingPlans.Returns(planCollection);

        var completionCollection = TrainingCompletionTestHelpers.CreateMockCompletionCollection([]);
        mongo.TrainingCompletions.Returns(completionCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<MarkWholeDayCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _logger);

        await ep.HandleAsync(
            new MarkWholeDayCompleteRequest(),
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo();
        var db = CreateMockDb();

        var ep = Factory.Create<MarkWholeDayCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity()),
            mongo, db, _notifier, _compliance, _logger);

        await ep.HandleAsync(
            new MarkWholeDayCompleteRequest(),
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}
